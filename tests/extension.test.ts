import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeforeAgentStartEvent, BeforeAgentStartEventResult, ExtensionAPI, ExtensionCommandContext, InputEventResult, RegisteredCommand } from "@earendil-works/pi-coding-agent";
import registerPiSddStack from "../src/extension.js";
import { COMMAND_NAMES } from "../src/util/constants.js";
import { createTempDir, ensureFile } from "./helpers.js";
import { runtimeStatePath } from "../src/sdd/runtimeState.js";
import {
  buildDocumentationTransformPrompt,
  getDocumentationPromptPack,
} from "../src/documentation/routing.js";
import { readText } from "../src/util/fs.js";

vi.mock("../src/util/requirements.js", () => ({
  assertRequirements: vi.fn().mockResolvedValue(undefined),
  inspectRequirements: vi.fn().mockResolvedValue({
    allOk: true,
    statuses: [],
  }),
}));

type CommandOptions = Omit<RegisteredCommand, "name" | "sourceInfo">;

function createExtensionHarness(): {
  commands: Map<string, CommandOptions>;
  tools: Map<string, unknown>;
  beforeAgentStartHandlers: Array<(event: BeforeAgentStartEvent, ctx?: { cwd: string }) => BeforeAgentStartEventResult | Promise<BeforeAgentStartEventResult | undefined> | undefined>;
  inputHandlers: Array<(event: { text: string }, ctx: { cwd: string }) => InputEventResult | Promise<InputEventResult | undefined> | undefined>;
  api: ExtensionAPI;
} {
  const commands = new Map<string, CommandOptions>();
  const tools = new Map<string, unknown>();
  const beforeAgentStartHandlers: Array<(event: BeforeAgentStartEvent, ctx?: { cwd: string }) => BeforeAgentStartEventResult | Promise<BeforeAgentStartEventResult | undefined> | undefined> = [];
  const inputHandlers: Array<(event: { text: string }, ctx: { cwd: string }) => InputEventResult | Promise<InputEventResult | undefined> | undefined> = [];

  const api = {
    registerCommand(name: string, options: CommandOptions) {
      commands.set(name, options);
    },
    on(eventName: string, handler: unknown) {
      if (eventName === "before_agent_start") {
        beforeAgentStartHandlers.push(handler as (event: BeforeAgentStartEvent, ctx?: { cwd: string }) => BeforeAgentStartEventResult);
      }
      if (eventName === "input") {
        inputHandlers.push(handler as (event: { text: string }, ctx: { cwd: string }) => InputEventResult);
      }
      return undefined;
    },
    registerTool(tool: { name: string }) {
      tools.set(tool.name, tool);
    },
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return {
    commands,
    tools,
    beforeAgentStartHandlers,
    inputHandlers,
    api,
  };
}

function createCommandContext(overrides: Partial<ExtensionCommandContext> = {}): ExtensionCommandContext {
  return {
    cwd: "/tmp/test-repo",
    hasUI: true,
    isIdle: vi.fn().mockReturnValue(true),
    waitForIdle: vi.fn().mockResolvedValue(undefined),
    sessionManager: {
      getSessionId: vi.fn().mockReturnValue("test-session-id"),
      getSessionFile: vi.fn().mockReturnValue("/tmp/pi-session.jsonl"),
    },
    ui: {
      notify: vi.fn(),
      select: vi.fn().mockResolvedValue("2. standard — tests are expected, but strict TDD is not enforced"),
      input: vi.fn(),
    },
    ...overrides,
  } as unknown as ExtensionCommandContext;
}

describe("registerPiSddStack", () => {
  const originalCwd = process.cwd();

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubEnv("PI_SDD_STACK_HOME", await createTempDir("pi-sdd-home"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("shows a friendly error when a slug is missing", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.PLAN);
    const ctx = createCommandContext();

    await command?.handler("   ", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Missing change slug. Usage: /sdd-stack:plan <slug>",
      "error",
    );
  });

  it("registers bootstrap-check command", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    expect(harness.commands.has(COMMAND_NAMES.BOOTSTRAP_CHECK)).toBe(true);
  });

  it("registers phase routing command", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    expect(harness.commands.has(COMMAND_NAMES.MODELS)).toBe(true);
  });

  it("registers requestedDomains helper command", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    expect(harness.commands.has(COMMAND_NAMES.REQUESTED_DOMAINS)).toBe(true);
  });

  it("injects explicit free-form SDD delegation rule", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    const result = await harness.beforeAgentStartHandlers[0]?.({
      type: "before_agent_start",
      prompt: "Quiero implementar una nueva feature",
      images: [],
      systemPrompt: "base prompt",
      systemPromptOptions: {} as BeforeAgentStartEvent["systemPromptOptions"],
    } as unknown as BeforeAgentStartEvent, { cwd: "/tmp/test-repo" });

    expect(result?.systemPrompt).toContain("Language rule: keep internal reasoning");
    expect(result?.systemPrompt).toContain("Reply to the user in the same language the conversation started in");
    expect(result?.systemPrompt).toContain("the parent session must not execute that phase locally");
    expect(result?.systemPrompt).toContain("Parent session orchestrates; phase agents execute");
    expect(result?.systemPrompt).toContain("Brownfield onboarding is for repository operational/documentation onboarding");
    expect(result?.message).toMatchObject({
       customType: "pi-sdd-stack-routing",
       display: false,
     });
   });

  it("adds collaborative PRD rule for brief-first prompts", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    const result = await harness.beforeAgentStartHandlers[0]?.({
      type: "before_agent_start",
      prompt: "quiero crear una nueva feature y tenemos que narrar el PRD juntos",
      images: [],
      systemPrompt: "base prompt",
      systemPromptOptions: {} as BeforeAgentStartEvent["systemPromptOptions"],
    } as unknown as BeforeAgentStartEvent, { cwd: "/tmp/test-repo" });

    expect(result?.systemPrompt).toContain("do not launch current-state exploration until the feature definition");
    expect(result?.systemPrompt).toContain("Avoid abstract opening questions like 'what problem does it solve?'");
  });

  it("adds feature-opening brief rule for broad feature prompts", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    const result = await harness.beforeAgentStartHandlers[0]?.({
      type: "before_agent_start",
      prompt: "quiero implementar una nueva feature",
      images: [],
      systemPrompt: "base prompt",
      systemPromptOptions: {} as BeforeAgentStartEvent["systemPromptOptions"],
    } as unknown as BeforeAgentStartEvent, { cwd: "/tmp/test-repo" });

    expect(result?.systemPrompt).toContain("do not start with ask_user_question");
    expect(result?.systemPrompt).toContain("First reply with a short free-text PRD brief invitation in the user's language");
    expect(result?.systemPrompt).toContain("Keep hidden routing context invisible; never echo it to the user");
  });

  it("does not leak routing primer into visible user input", async () => {
    const repoRoot = await createTempDir("feature-primer");
    await ensureFile(path.join(repoRoot, "package.json"), "{}\n");
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    const result = await harness.inputHandlers[0]?.({ text: "Quiero implementar una nueva feature" }, { cwd: repoRoot });

    expect(result).toEqual({ action: "continue" });
  });

  it("suppresses documentation-target prompting during sdd flow", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const tool = harness.tools.get("choose_documentation_target") as {
      execute: (_toolCallId: string, params: { userRequest: string; locale?: string }, _signal: AbortSignal | undefined, _onUpdate: undefined, ctx: ExtensionCommandContext) => Promise<{ content: Array<{ type: string; text: string }>; details: unknown }>;
    };
    const ctx = createCommandContext();

    const result = await tool.execute(
      "tool-sdd",
      { userRequest: "Quiero implementar una nueva feature y para eso tenemos que hacer el PRD" },
      undefined,
      undefined,
      ctx,
    );

    expect(result.content[0]?.text).toContain("This is an SDD/OpenSpec flow");
    expect(ctx.ui.select).not.toHaveBeenCalled();
  });

  it("prepares OpenSpec scaffold before delegated spec phase", async () => {
    const repoRoot = await createTempDir("extension-spec-scaffold");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "prd.md"), "# PRD\n");

    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.SPEC);
    const ctx = createCommandContext({ cwd: repoRoot });

    await command?.handler("add-dark-mode", ctx);

    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "proposal.md"))).toContain("# Proposal: Add Dark Mode");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "specs", "add", "spec.md"))).toContain("# add Specification Delta");
    expect(harness.api.sendUserMessage).toHaveBeenCalledWith(expect.stringContaining("openspec/changes/add-dark-mode/proposal.md"));
    expect(harness.api.sendUserMessage).toHaveBeenCalledWith(expect.stringContaining("openspec/changes/add-dark-mode/specs/add/spec.md"));
  });

  it("registers subagent-only phase commands", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    expect(harness.commands.has(COMMAND_NAMES.BROWNFIELD_ONBOARD)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.GREENFIELD_ONBOARD)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.CURRENT_STATE_EXPLORE)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.DOCUMENTATION_REVIEW)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.SPEC)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.DESIGN)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.TASKS)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.BUGFIX_MEMORY)).toBe(true);
    expect(harness.commands.has(COMMAND_NAMES.RESUME)).toBe(true);
  });

  it("blocks overlapping delegated phase with human label", async () => {
    const repoRoot = await createTempDir("extension-runtime");
    await ensureFile(await runtimeStatePath(repoRoot, "test-session-id"), JSON.stringify({
      active: {
        label: "dog-fly-away",
        slug: "add-dark-mode",
        phase: "prd",
        command: "/run pi-sdd-product \"task\"",
        status: "running",
        startedAt: "2026-06-04T20:00:00.000Z",
        updatedAt: "2026-06-04T20:00:00.000Z"
      },
      history: []
    }));

    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.APPLY);
    const ctx = createCommandContext({ cwd: repoRoot });

    await command?.handler("add-dark-mode", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Active delegated phase already running: dog-fly-away (prd for add-dark-mode). Resume it with /sdd-stack:resume.",
      "error",
    );
  });

  it("resumes recorded delegation by label", async () => {
    const repoRoot = await createTempDir("extension-resume");
    await ensureFile(await runtimeStatePath(repoRoot, "test-session-id"), JSON.stringify({
      history: [{
        label: "cat-run-slow",
        slug: "add-dark-mode",
        phase: "prd",
        command: "/run pi-sdd-product \"task\"",
        status: "returned",
        startedAt: "2026-06-04T20:00:00.000Z",
        updatedAt: "2026-06-04T20:05:00.000Z"
      }]
    }));

    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.RESUME);
    const ctx = createCommandContext({ cwd: repoRoot });

    await command?.handler("cat-run-slow", ctx);

    expect(harness.api.sendUserMessage).toHaveBeenCalledWith('/run pi-sdd-product "task"');
  });

  it("does not wait for idle after launching background scout delegation", async () => {
    const repoRoot = await createTempDir("extension-bg-delegation");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "add-dark-mode", ".gitkeep"), "");

    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.BROWNFIELD_ONBOARD);
    const waitForIdle = vi.fn().mockResolvedValue(undefined);
    const ctx = createCommandContext({ cwd: repoRoot, waitForIdle });

    await command?.handler("add-dark-mode", ctx);

    expect(harness.api.sendUserMessage).toHaveBeenCalledWith(expect.stringContaining(" --bg"));
    expect(waitForIdle).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Detached SDD subagent"),
      "info",
    );
  });

  it("shows a friendly error when a query is missing", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.MEMORY_SEARCH);
    const ctx = createCommandContext();

    await command?.handler("", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Missing search query. Usage: /sdd-stack:memory-search <query>",
      "error",
    );
  });

  it("falls back to console output when UI is unavailable", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.MEMORY_SEARCH);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ctx = createCommandContext({ hasUI: false });

    await command?.handler("", ctx);

    expect(errorSpy).toHaveBeenCalledWith(
      "Missing search query. Usage: /sdd-stack:memory-search <query>",
    );
  });

  it("offers init flag completions", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.INIT);

    const items = await command?.getArgumentCompletions?.("--skip");

    expect(items).toEqual([
      {
        value: "--skip-openspec",
        label: "--skip-openspec",
        description: "Skip OpenSpec schema installation.",
      },
    ]);
  });

  it("offers change slug completions from openspec/changes", async () => {
    const repoRoot = await createTempDir("extension-completions");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "add-team-invitations", ".gitkeep"), "");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "fix-invite-expiry", ".gitkeep"), "");
    process.chdir(repoRoot);

    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.APPLY);

    const items = await command?.getArgumentCompletions?.("add");

    expect(items).toEqual([
      {
        value: "add-team-invitations",
        label: "add-team-invitations",
        description: "Existing OpenSpec change slug.",
      },
    ]);
  });

  it("reads and updates requestedDomains through the helper command", async () => {
    const repoRoot = await createTempDir("extension-requested-domains");
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const command = harness.commands.get(COMMAND_NAMES.REQUESTED_DOMAINS);
    const ctx = createCommandContext({ cwd: repoRoot });

    await command?.handler("attach-avatar client,auth", ctx);

    expect(await readText(path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md"))).toContain("requestedDomains:");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md"))).toContain("- client");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md"))).toContain("- auth");
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("requestedDomains=client, auth"),
      "info",
    );

    await command?.handler("attach-avatar", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("usage= /sdd-stack:requested-domains attach-avatar domain1,domain2 or /sdd-stack:requested-domains attach-avatar --clear"),
      "info",
    );
  });

  it("registers documentation clarification tool and recommends AGENTS first", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const tool = harness.tools.get("choose_documentation_target") as {
      execute: (_toolCallId: string, params: { userRequest: string; locale?: string }, _signal: AbortSignal | undefined, _onUpdate: undefined, ctx: ExtensionCommandContext) => Promise<{ content: Array<{ type: string; text: string }>; details: unknown }>;
    };
    const ctx = createCommandContext({
      ui: {
        notify: vi.fn(),
        select: vi.fn().mockResolvedValue(getDocumentationPromptPack("es").options[0]),
        input: vi.fn(),
      } as unknown as ExtensionCommandContext["ui"],
    });

    const result = await tool.execute(
      "tool-1",
      { userRequest: "Quiero documentar este código ya que está incompleta la documentación" },
      undefined,
      undefined,
      ctx,
    );

    expect(result.content[0]?.text).toBe(
      buildDocumentationTransformPrompt(
        "agents",
        "Quiero documentar este código ya que está incompleta la documentación",
      ),
    );
  });

  it("localizes the documentation question in english", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);
    const tool = harness.tools.get("choose_documentation_target") as {
      execute: (_toolCallId: string, params: { userRequest: string; locale?: string }, _signal: AbortSignal | undefined, _onUpdate: undefined, ctx: ExtensionCommandContext) => Promise<unknown>;
    };
    const select = vi.fn().mockResolvedValue(getDocumentationPromptPack("en").options[0]);
    const ctx = createCommandContext({
      ui: {
        notify: vi.fn(),
        select,
        input: vi.fn(),
      } as unknown as ExtensionCommandContext["ui"],
    });

    await tool.execute(
      "tool-2",
      { userRequest: "I want to document this code because the docs are incomplete" },
      undefined,
      undefined,
      ctx,
    );

    expect(select).toHaveBeenCalledWith(
      "Which documentation should we improve first? Examples: AGENTS.md for project context, README.md for human onboarding, OpenSpec for requirements and active changes.",
      getDocumentationPromptPack("en").options,
    );
  });
});

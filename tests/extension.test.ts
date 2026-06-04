import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI, ExtensionCommandContext, RegisteredCommand } from "@earendil-works/pi-coding-agent";
import registerPiSddStack from "../src/extension.js";
import { COMMAND_NAMES } from "../src/util/constants.js";
import { createTempDir, ensureFile } from "./helpers.js";
import {
  buildDocumentationTransformPrompt,
  getDocumentationPromptPack,
} from "../src/documentation/routing.js";

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
  api: ExtensionAPI;
} {
  const commands = new Map<string, CommandOptions>();
  const tools = new Map<string, unknown>();

  const api = {
    registerCommand(name: string, options: CommandOptions) {
      commands.set(name, options);
    },
    on() {
      return undefined;
    },
    registerTool(tool: { name: string }) {
      tools.set(tool.name, tool);
    },
  } as unknown as ExtensionAPI;

  return {
    commands,
    tools,
    api,
  };
}

function createCommandContext(overrides: Partial<ExtensionCommandContext> = {}): ExtensionCommandContext {
  return {
    cwd: "/tmp/test-repo",
    hasUI: true,
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

  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("registers models command", async () => {
    const harness = createExtensionHarness();
    registerPiSddStack(harness.api);

    expect(harness.commands.has(COMMAND_NAMES.MODELS)).toBe(true);
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

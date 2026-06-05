import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { PHASE_NAMES, type PhaseName } from "./models/phaseRoutes.js";
import { Type } from "typebox";
import { COMMAND_NAMES } from "./util/constants.js";
import { runDoctor } from "./commands/doctor.js";
import { runBootstrapCheck } from "./commands/bootstrapCheck.js";
import { openModelsEditor, runModels } from "./commands/models.js";
import { chooseTddMode, ensureTddModeChosen, runTddMode } from "./commands/tddMode.js";
import { runStatus } from "./commands/status.js";
import { runInit } from "./commands/init.js";
import { runMemorySearch } from "./commands/memorySearch.js";
import { runRequestedDomains } from "./commands/requestedDomains.js";
import { completeChangeSlug, completeInitArgs } from "./commands/completions.js";
import { buildPhaseSubagentCommand, ensureManagedSubagents } from "./subagents/phaseDelegation.js";
import {
  buildDocumentationTransformPrompt,
  detectDocumentationLocale,
  getDocumentationChoiceMetadata,
  getDocumentationPromptPack,
  mapDocumentationSelection,
} from "./documentation/routing.js";
import { assertRequirements } from "./util/requirements.js";
import { getNextRecommendedPhaseAsync } from "./sdd/orchestrator.js";
import { findDelegationByLabel, markDelegationFailed, markDelegationReturned, markDelegationRunning, readRuntimeState, type RuntimeSessionRef } from "./sdd/runtimeState.js";
import { buildPhaseReturnDigest } from "./sdd/phaseDigest.js";
import { pathExists } from "./util/fs.js";
import path from "node:path";
import { prepareOpenSpecArtifacts } from "./openspec/changeScaffolding.js";

function notify(ctx: ExtensionCommandContext, message: string, level: "info" | "warning" | "error" = "info"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
    return;
  }

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warning") {
    console.warn(message);
    return;
  }

  console.info(message);
}

async function runCommand(
  ctx: ExtensionCommandContext,
  action: () => Promise<string>,
): Promise<void> {
  try {
    const message = await action();
    notify(ctx, message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pi-sdd-stack command error.";
    notify(ctx, message, "error");
  }
}

async function runProtectedCommand(
  ctx: ExtensionCommandContext,
  action: () => Promise<string>,
): Promise<void> {
  await runCommand(ctx, async () => {
    await assertRequirements(ctx.cwd);
    return action();
  });
}

async function runProtectedSddCommand(
  ctx: ExtensionCommandContext,
  action: () => Promise<string>,
): Promise<void> {
  await runProtectedCommand(ctx, async () => {
    await ensureTddModeChosen(ctx);
    return action();
  });
}

function getRuntimeSessionRef(ctx: ExtensionCommandContext): RuntimeSessionRef {
  const sessionFile = ctx.sessionManager.getSessionFile();
  return {
    sessionId: ctx.sessionManager.getSessionId(),
    ...(sessionFile ? { sessionFile } : {}),
  };
}

function isBackgroundDelegationCommand(command: string): boolean {
  return /(?:^|\s)--bg\s*$/.test(command);
}

async function runDelegatedPhaseCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  phase: PhaseName,
  slug: string,
  options?: { commandOverride?: string; labelOverride?: string },
): Promise<string> {
  const session = getRuntimeSessionRef(ctx);
  const runtime = await readRuntimeState(ctx.cwd, session);
  if (runtime.active && !options?.commandOverride) {
    throw new Error(`Active delegated phase already running: ${runtime.active.label} (${runtime.active.phase} for ${runtime.active.slug}). Resume it with /${COMMAND_NAMES.RESUME}.`);
  }

  await ensureManagedSubagents(ctx.cwd, import.meta.url);
  if (!options?.commandOverride) {
    await prepareOpenSpecArtifacts(ctx.cwd, slug, phase);
  }
  const command = options?.commandOverride ?? await buildPhaseSubagentCommand(ctx.cwd, slug, phase, import.meta.url);
  const active = await markDelegationRunning(ctx.cwd, { session, slug, phase, command, ...(options?.labelOverride ? { label: options.labelOverride } : {}) });

  notify(ctx, `Launching SDD subagent ${active.label} · phase=${phase} · slug=${slug}`);

  try {
    pi.sendUserMessage(command);
    if (isBackgroundDelegationCommand(command)) {
      await markDelegationReturned(ctx.cwd, "Subagent launched in background. Track progress with subagent status tooling or the async run UI.", session);
      notify(ctx, `Detached SDD subagent ${active.label} · phase=${phase} · slug=${slug}`);
      return [
        `delegated label=${active.label}`,
        `phase=${phase}`,
        `command=${command}`,
        "status=detached",
      ].join("\n");
    }
    await ctx.waitForIdle();
    await markDelegationReturned(ctx.cwd, "Subagent returned control to orchestrator.", session);
    notify(ctx, `Returned SDD subagent ${active.label} · phase=${phase} · slug=${slug}`);
    const digest = await buildPhaseReturnDigest(ctx.cwd, slug, phase);
    if (digest) {
      pi.sendMessage({
        customType: "pi-sdd-stack-phase-return",
        content: digest,
        display: true,
        details: { slug, phase, label: active.label },
      });
    }
    return [
      `delegated label=${active.label}`,
      `phase=${phase}`,
      `command=${command}`,
      "status=returned",
      ...(digest ? ["", digest] : []),
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delegated phase error.";
    await markDelegationFailed(ctx.cwd, message, session);
    notify(ctx, `Failed SDD subagent ${active.label} · phase=${phase} · slug=${slug} · ${message}`, "error");
    throw error;
  }
}

function looksLikeRepoRoot(cwd: string): boolean {
  return pathExists(path.join(cwd, ".git"))
    || pathExists(path.join(cwd, "package.json"))
    || pathExists(path.join(cwd, "openspec"))
    || pathExists(path.join(cwd, "src"));
}

function isSddFeatureRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  if (normalized.startsWith("/")) {
    return false;
  }

  return /(nueva feature|new feature|implementar|implement|añadir|agregar|add field|nuevo campo|profile photo|avatar|foto de perfil|requirements|prd|openspec|spec|design|tasks|verify)/i.test(normalized);
}

function isCollaborativePrdRequest(text: string): boolean {
  return /(narrar el prd juntos|hacer el prd juntos|definir el prd|brief previo|idea inicial|narrate the prd|write the prd together|initial idea)/i.test(text.toLowerCase());
}

function isFeatureOpeningRequest(text: string): boolean {
  return /^(quiero (implementar|crear|añadir|agregar) (una )?(nueva )?feature|quiero hacer el prd|new feature|i want to (implement|create|add) (a )?new feature)/i.test(text.trim().toLowerCase());
}

function buildHiddenSddRoutingContext(text: string, cwd: string): string {
  const repoMode = looksLikeRepoRoot(cwd) ? "existing repo" : "generic context";
  return [
    `Hidden routing context: ${repoMode}.`,
    "If this is feature-sized SDD work, clarify only what is missing.",
    "Then delegate before any parent read/bash/edit/write.",
    "For an existing repo and a new feature or PRD request, use current-state exploration as optional technical context before PRD when needed.",
    "If the user wants to narrate or define the PRD together from an initial idea, do not launch current-state exploration until these are explicit: feature definition, primary actor, affected object/entity, desired outcome, and one key rule.",
    "In collaborative PRD mode, ask product-semantic questions first; code exploration is a later optional step to complement the PRD, not to guess the concept.",
    "For broad feature-opening requests, do not start with ask_user_question. First invite a free-text PRD brief: what to add, who it is for, what should happen, and any important rule or constraint.",
    "After the user gives an acceptable free-text brief, current-state exploration may run to add technical context. Only then ask narrower follow-up questions if gaps remain.",
    "Avoid abstract opening questions like 'what problem does it solve?' when the concept is still fuzzy. Prefer concrete questions: what is the feature, who performs the main action, on what entity/object, what visible result should exist, and what rule matters most.",
    "Do not call choose_documentation_target for PRD, OpenSpec, spec, design, tasks, apply, verify, archive, or brownfield SDD flows unless the user explicitly asked to work on documentation as the primary task.",
    "If AGENTS.md, README.md, or OpenSpec already exist, use them as context instead of opening a documentation chooser.",
    `User request: ${text}`,
  ].join("\n");
}

function requireArgument(rawArgs: string, usage: string, label: string): string {
  const value = rawArgs.trim();
  if (value.length > 0) {
    return value;
  }

  throw new Error(`Missing ${label}. Usage: ${usage}`);
}

export default function registerPiSddStack(pi: ExtensionAPI): void {
  pi.on("input", async (_event, _ctx) => {
    return { action: "continue" };
  });

  pi.on("before_agent_start", (event, ctx) => {
    const hiddenSddContext = typeof event.prompt === "string" && isSddFeatureRequest(event.prompt)
      ? {
          message: {
            customType: "pi-sdd-stack-routing",
            content: buildHiddenSddRoutingContext(event.prompt, ctx.cwd),
            display: false,
          },
        }
      : {};
    const collaborativePrdRule = typeof event.prompt === "string" && isCollaborativePrdRequest(event.prompt)
      ? " In collaborative PRD mode, do not launch current-state exploration until the feature definition, primary actor, affected object/entity, desired outcome, and a key business rule are explicit. Ask those questions first. Avoid abstract opening questions like 'what problem does it solve?' when the concept is still fuzzy; prefer concrete semantic questions about feature, actor, entity/object, visible result, and key rule."
      : "";
    const featureOpeningRule = typeof event.prompt === "string" && isFeatureOpeningRequest(event.prompt)
      ? " For broad feature-opening requests, do not start with ask_user_question. First reply with a short free-text PRD brief invitation in the user's language, for example: 'Let's prepare the PRD. Tell me the idea in free text: what you want to add, who it is for, what should happen, and any important rule.' Wait for that brief before current-state exploration. Keep hidden routing context invisible; never echo it to the user."
      : "";

    return {
      ...hiddenSddContext,
      systemPrompt: `${event.systemPrompt}\n\nLanguage rule: keep internal reasoning, system guidance, skills, phase instructions, artifact-planning directives, and tool-oriented prompts in English. Reply to the user in the same language the conversation started in, unless the user explicitly asks to switch languages.\n\nDocumentation routing rule: when the user asks to understand, review, improve, or create project documentation and the target documentation surface is ambiguous, use the tool \"choose_documentation_target\" before writing files. This applies regardless of the user's language. Do not default to README.md when AGENTS.md or OpenSpec is a better fit. Do not call choose_documentation_target during PRD/OpenSpec/SDD execution unless the user explicitly asked to work on documentation as the main deliverable.\n\nSDD delegation rule: you are an orchestrator, not the default executor for substantial SDD work. If pi-sdd-stack routing selects any SDD phase or skill such as brownfield onboarding, greenfield onboarding, current-state exploration, documentation review, PRD, spec, design, tasks, apply, verify, archive, or bugfix memory, the parent session must not execute that phase locally. The parent may clarify scope in-chat, but before any repo exploration, drafting, or implementation for that phase, it must delegate the phase to a subagent or the matching /sdd-stack:* command. If you are about to use read/bash/edit/write in the parent for a routed SDD phase, stop and delegate instead. Parent session orchestrates; phase agents execute. Delegation is not optional once complexity appears. Brownfield onboarding is for repository operational/documentation onboarding, not for ordinary feature PRDs. For an existing repo and a new feature or PRD request, use current-state exploration only when extra technical context is needed before the PRD.${collaborativePrdRule}${featureOpeningRule}`,
    };
  });

  pi.registerTool({
    name: "choose_documentation_target",
    label: "Choose Documentation Target",
    description: "Clarify which documentation surface the user wants before writing files: AGENTS.md, README.md, OpenSpec, technical docs, all, or other. Use this for ambiguous documentation requests in any language.",
    promptSnippet: "Clarify ambiguous documentation requests in any language before creating README, AGENTS, OpenSpec, or technical docs.",
    promptGuidelines: [
      "Use choose_documentation_target when the user asks to understand, review, improve, or create project documentation but does not specify whether they want AGENTS.md, README.md, OpenSpec, technical docs, or all of them.",
      "Use choose_documentation_target before writing documentation files if the target surface is ambiguous, even when the user writes in a language other than English.",
      "Prefer AGENTS.md for operational project context, README.md for human onboarding, and OpenSpec for source-of-truth behavior documentation.",
    ],
    parameters: Type.Object({
      userRequest: Type.String({ description: "The user's original documentation request." }),
      locale: Type.Optional(Type.String({ description: "Use 'es' for Spanish or 'en' for English. If omitted, infer from the request." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (isSddFeatureRequest(params.userRequest) || /(openspec|\bprd\b|\bspec\b|\bdesign\b|\btasks\b|\bverify\b|brownfield)/i.test(params.userRequest)) {
        return {
          content: [{ type: "text", text: `The user asked: "${params.userRequest}". This is an SDD/OpenSpec flow, not a general documentation request. Use existing AGENTS.md, README.md, and openspec/ as context when present. Do not ask for a documentation target. Continue the SDD phase flow instead.` }],
          details: {
            cancelled: false,
            choice: "openspec",
            label: "OpenSpec",
            customRequest: undefined,
            locale: params.locale ?? detectDocumentationLocale(params.userRequest),
            transformedPrompt: `The user asked: "${params.userRequest}". This is an SDD/OpenSpec flow, not a general documentation request. Use existing AGENTS.md, README.md, and openspec/ as context when present. Do not ask for a documentation target. Continue the SDD phase flow instead.`,
            instruction: "Skip documentation-target prompting during SDD/OpenSpec flows.",
          },
        };
      }

      const locale = params.locale === "en" || params.locale === "es"
        ? params.locale
        : detectDocumentationLocale(params.userRequest);
      const promptPack = getDocumentationPromptPack(locale);
      const selection = await ctx.ui.select(promptPack.title, promptPack.options);

      if (!selection) {
        return {
          content: [{ type: "text", text: locale === "en" ? "The user cancelled the documentation choice." : "El usuario canceló la elección de documentación." }],
          details: { cancelled: true },
        };
      }

      const choice = mapDocumentationSelection(selection);
      const customRequest = choice === "other"
        ? await ctx.ui.input(promptPack.customPromptTitle, promptPack.customPromptPlaceholder)
        : undefined;
      const transformedPrompt = buildDocumentationTransformPrompt(choice, params.userRequest, customRequest);
      const metadata = getDocumentationChoiceMetadata(locale).find((entry) => entry.choice === choice);

      return {
        content: [{ type: "text", text: transformedPrompt }],
        details: {
          cancelled: false,
          choice,
          label: metadata?.label ?? selection,
          customRequest,
          locale,
          transformedPrompt,
          instruction: metadata?.instruction ?? transformedPrompt,
        },
      };
    },
  });

  pi.registerCommand(COMMAND_NAMES.DOCTOR, {
    description: "Inspect repo readiness for pi-sdd-stack",
    handler: async (_args, ctx) => runCommand(ctx, async () => runDoctor(ctx.cwd)),
  });

  pi.registerCommand(COMMAND_NAMES.BOOTSTRAP_CHECK, {
    description: "Check required runtime dependencies before using pi-sdd-stack",
    handler: async (_args, ctx) => runCommand(ctx, async () => runBootstrapCheck(ctx.cwd)),
  });

  pi.registerCommand(COMMAND_NAMES.MODELS, {
    description: "Show effective per-phase routing for pi-sdd-stack",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        await runCommand(ctx, async () => runModels(ctx.cwd));
        return;
      }

      await runCommand(ctx, async () => openModelsEditor(ctx));
    },
  });

  pi.registerCommand(COMMAND_NAMES.TDD_MODE, {
    description: "View or choose the project's TDD mode (strict, standard, off)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        await runCommand(ctx, async () => runTddMode(ctx.cwd));
        return;
      }

      await runCommand(ctx, async () => chooseTddMode(ctx));
    },
  });

  pi.registerCommand(COMMAND_NAMES.STATUS, {
    description: "Show phase graph status for a change slug",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runStatus(ctx.cwd, requireArgument(args, "/sdd-stack:status <slug>", "change slug"), getRuntimeSessionRef(ctx))),
  });

  pi.registerCommand(COMMAND_NAMES.CONTINUE, {
    description: "Run the next ready orchestration step for a change slug",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => {
      const slug = requireArgument(args, "/sdd-stack:continue <slug>", "change slug");
      const next = await getNextRecommendedPhaseAsync(ctx.cwd, slug);
      if (!next) {
        return `No next phase is ready for ${slug}. Run /sdd-stack:status ${slug} to inspect the graph.`;
      }
      return runDelegatedPhaseCommand(pi, ctx, next.phase as PhaseName, slug);
    }),
  });

  pi.registerCommand(COMMAND_NAMES.BROWNFIELD_ONBOARD, {
    description: "Run brownfield onboarding in a subagent",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.BROWNFIELD_ONBOARD, requireArgument(args, "/sdd-stack:brownfield-onboard <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.GREENFIELD_ONBOARD, {
    description: "Run greenfield onboarding in a subagent",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.GREENFIELD_ONBOARD, requireArgument(args, "/sdd-stack:greenfield-onboard <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.CURRENT_STATE_EXPLORE, {
    description: "Run current-state exploration in a subagent",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.CURRENT_STATE_EXPLORE, requireArgument(args, "/sdd-stack:current-state-explore <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.DOCUMENTATION_REVIEW, {
    description: "Run documentation review in a subagent",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.DOCUMENTATION_REVIEW, requireArgument(args, "/sdd-stack:documentation-review <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.INIT, {
    description: "Initialize pi-sdd-stack in the current repo",
    getArgumentCompletions: async (prefix) => completeInitArgs(prefix),
    handler: async (args, ctx) => runProtectedCommand(ctx, async () => runInit(ctx.cwd, args)),
  });

  pi.registerCommand(COMMAND_NAMES.PRD, {
    description: "Create or update a PRD for a change slug",
    getArgumentCompletions: async (prefix, ) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.PRD, requireArgument(args, "/sdd-stack:prd <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.REQUESTED_DOMAINS, {
    description: "Read or update requestedDomains in openspec/changes/<slug>/prd.md",
    getArgumentCompletions: async (prefix) => {
      if (prefix.trim().includes(" ")) {
        return null;
      }
      return completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug.");
    },
    handler: async (args, ctx) => runProtectedCommand(ctx, async () => runRequestedDomains(ctx.cwd, args)),
  });

  pi.registerCommand(COMMAND_NAMES.PLAN, {
    description: "Start planning flow at spec, then review each phase before continuing",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.SPEC, requireArgument(args, "/sdd-stack:plan <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.SPEC, {
    description: "Create or refine proposal and delta specs for a change slug",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.SPEC, requireArgument(args, "/sdd-stack:spec <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.DESIGN, {
    description: "Create or refine design for a change slug",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.DESIGN, requireArgument(args, "/sdd-stack:design <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.TASKS, {
    description: "Create or refine tasks for a change slug",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.TASKS, requireArgument(args, "/sdd-stack:tasks <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.APPLY, {
    description: "Guide implementation for a planned change",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.APPLY, requireArgument(args, "/sdd-stack:apply <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.VERIFY, {
    description: "Create or update verify.md for a change",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.VERIFY, requireArgument(args, "/sdd-stack:verify <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.ARCHIVE, {
    description: "Safely archive a change through OpenSpec CLI when available",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.ARCHIVE, requireArgument(args, "/sdd-stack:archive <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.BUGFIX_MEMORY, {
    description: "Run bugfix memory capture in a subagent",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runDelegatedPhaseCommand(pi, ctx, PHASE_NAMES.BUGFIX_MEMORY, requireArgument(args, "/sdd-stack:bugfix-memory <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.RESUME, {
    description: "Resume the active delegated phase, or /sdd-stack:resume <label> for a recorded run",
    handler: async (_args, ctx) => runProtectedSddCommand(ctx, async () => {
      const label = _args.trim();
      if (label.length > 0) {
        const entry = await findDelegationByLabel(ctx.cwd, label, getRuntimeSessionRef(ctx));
        if (!entry) {
          return `No delegated phase found for label ${label}.`;
        }
        return runDelegatedPhaseCommand(pi, ctx, entry.phase, entry.slug, {
          commandOverride: entry.command,
          labelOverride: entry.label,
        });
      }

      const runtime = await readRuntimeState(ctx.cwd, getRuntimeSessionRef(ctx));
      if (!runtime.active) {
        return "No active delegated phase recorded.";
      }
      return runDelegatedPhaseCommand(pi, ctx, runtime.active.phase, runtime.active.slug, {
        commandOverride: runtime.active.command,
        labelOverride: runtime.active.label,
      });
    }),
  });

  pi.registerCommand(COMMAND_NAMES.MEMORY_SEARCH, {
    description: "Search strict Engram memory if integration is available",
    handler: async (args, ctx) => runProtectedCommand(ctx, async () => runMemorySearch(requireArgument(args, "/sdd-stack:memory-search <query>", "search query"))),
  });
}

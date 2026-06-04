import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { COMMAND_NAMES } from "./util/constants.js";
import { runDoctor } from "./commands/doctor.js";
import { runBootstrapCheck } from "./commands/bootstrapCheck.js";
import { openModelsEditor, runModels } from "./commands/models.js";
import { chooseTddMode, ensureTddModeChosen, runTddMode } from "./commands/tddMode.js";
import { runStatus } from "./commands/status.js";
import { runContinue } from "./commands/continue.js";
import { runInit } from "./commands/init.js";
import { runPrd } from "./commands/prd.js";
import { runPlan } from "./commands/plan.js";
import { runApply } from "./commands/apply.js";
import { runVerify } from "./commands/verify.js";
import { runArchive } from "./commands/archive.js";
import { runMemorySearch } from "./commands/memorySearch.js";
import { completeChangeSlug, completeInitArgs } from "./commands/completions.js";
import {
  buildDocumentationTransformPrompt,
  detectDocumentationLocale,
  getDocumentationChoiceMetadata,
  getDocumentationPromptPack,
  mapDocumentationSelection,
} from "./documentation/routing.js";
import { assertRequirements } from "./util/requirements.js";

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

function requireArgument(rawArgs: string, usage: string, label: string): string {
  const value = rawArgs.trim();
  if (value.length > 0) {
    return value;
  }

  throw new Error(`Missing ${label}. Usage: ${usage}`);
}

export default function registerPiSddStack(pi: ExtensionAPI): void {
  pi.on("before_agent_start", (event) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\nDocumentation routing rule: when the user asks to understand, review, improve, or create project documentation and the target documentation surface is ambiguous, use the tool \"choose_documentation_target\" before writing files. This applies regardless of the user's language. Do not default to README.md when AGENTS.md or OpenSpec is a better fit.`,
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
    description: "Show effective model profiles and phase routes for pi-sdd-stack",
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
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runStatus(ctx.cwd, requireArgument(args, "/sdd-stack:status <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.CONTINUE, {
    description: "Run the next ready orchestration step for a change slug",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runContinue(ctx.cwd, requireArgument(args, "/sdd-stack:continue <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.INIT, {
    description: "Initialize pi-sdd-stack in the current repo",
    getArgumentCompletions: async (prefix) => completeInitArgs(prefix),
    handler: async (args, ctx) => runProtectedCommand(ctx, async () => runInit(ctx.cwd, args)),
  });

  pi.registerCommand(COMMAND_NAMES.PRD, {
    description: "Create or update a PRD for a change slug",
    getArgumentCompletions: async (prefix, ) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runPrd(ctx.cwd, requireArgument(args, "/sdd-stack:prd <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.PLAN, {
    description: "Generate proposal, specs, design and tasks from a PRD",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runPlan(ctx.cwd, requireArgument(args, "/sdd-stack:plan <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.APPLY, {
    description: "Guide implementation for a planned change",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runApply(ctx.cwd, requireArgument(args, "/sdd-stack:apply <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.VERIFY, {
    description: "Create or update verify.md for a change",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runVerify(ctx.cwd, requireArgument(args, "/sdd-stack:verify <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.ARCHIVE, {
    description: "Safely archive a change through OpenSpec CLI when available",
    getArgumentCompletions: async (prefix) => completeChangeSlug(process.cwd(), prefix, "Existing OpenSpec change slug."),
    handler: async (args, ctx) => runProtectedSddCommand(ctx, async () => runArchive(ctx.cwd, requireArgument(args, "/sdd-stack:archive <slug>", "change slug"))),
  });

  pi.registerCommand(COMMAND_NAMES.MEMORY_SEARCH, {
    description: "Search strict Engram memory if integration is available",
    handler: async (args, ctx) => runProtectedCommand(ctx, async () => runMemorySearch(requireArgument(args, "/sdd-stack:memory-search <query>", "search query"))),
  });
}

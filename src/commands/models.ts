import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";
import path from "node:path";
import { ensureDir, writeText } from "../util/fs.js";
import type { ModelRoutesConfig, PhaseRoute } from "../models/modelRouter.js";
import { ModelRouter } from "../models/modelRouter.js";

interface AvailableModelOption {
  id: string;
  reasoning: boolean;
}

const CAVEMAN_OUTPUT_LEVELS = ["off", "lite", "full", "ultra", "wenyan-lite", "wenyan", "wenyan-ultra", "micro"] as const;

const ACTIONS = {
  CANCEL: "cancel",
  SAVE: "save",
  EDIT_MODEL: "edit-model",
  EDIT_THINKING: "edit-thinking",
  EDIT_CAVEMAN_OUTPUT: "edit-caveman-output",
} as const;

type ActionKind = (typeof ACTIONS)[keyof typeof ACTIONS];

interface EditorAction {
  kind: ActionKind;
  phaseName?: string;
}

const THINKING_LEVELS = ["inherit", "low", "medium", "high"] as const;

function cloneConfig(config: ModelRoutesConfig): ModelRoutesConfig {
  return JSON.parse(JSON.stringify(config)) as ModelRoutesConfig;
}

async function saveModelOverrides(repoRoot: string, config: ModelRoutesConfig): Promise<string> {
  const targetPath = ModelRouter.userConfigPath();
  await ensureDir(path.dirname(targetPath));
  await writeText(targetPath, `${JSON.stringify(config, null, 2)}\n`);
  return targetPath;
}

function formatPhaseLine(phaseName: string, route: PhaseRoute): string {
  return `${phaseName.padEnd(22)} model=${route.model.padEnd(24)} thinking=${route.thinking.padEnd(7)} caveman=${route["caveman-output"]}`;
}

function renderEditor(config: ModelRoutesConfig, phaseNames: string[], selectedIndex: number): string[] {
  return [
    "pi-sdd-stack model editor",
    "",
    "Per-phase routing (one model + one thinking level per phase)",
    "",
    ...phaseNames.map((phaseName, index) => {
      const prefix = index === selectedIndex ? ">" : " ";
      return `${prefix} ${formatPhaseLine(phaseName, config.phases[phaseName]!)}`;
    }),
    "",
    "Keys: ↑/↓ move · Enter edit model · E edit thinking · C edit caveman-output · S save · Esc cancel",
  ];
}

async function getAvailableModels(ctx: ExtensionCommandContext): Promise<AvailableModelOption[]> {
  const models = await ctx.modelRegistry.getAvailable();
  return models
    .map((model) => ({
      id: `${model.provider}/${model.id}`,
      reasoning: model.reasoning,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function runModels(cwd: string): Promise<string> {
  const router = await ModelRouter.create(import.meta.url, cwd);
  const config = router.getConfig();

  const lines: string[] = ["pi-sdd-stack model routes", "", "phases:"];
  for (const [phase, route] of Object.entries(config.phases)) {
    lines.push(`- ${phase}: model=${route.model}, thinking=${route.thinking}, caveman-output=${route["caveman-output"]}`);
  }

  return lines.join("\n");
}

export async function openModelsEditor(ctx: ExtensionCommandContext): Promise<string> {
  const router = await ModelRouter.create(import.meta.url, ctx.cwd);
  const config = cloneConfig(router.getConfig());
  const phaseNames = Object.keys(config.phases);
  if (phaseNames.length === 0) {
    return "Model editor could not load phase defaults. Re-run /sdd-stack:init or verify that model assets are installed.";
  }

  const availableModels = await getAvailableModels(ctx);
  let selectedIndex = 0;
  let dirty = false;

  while (true) {
    const action = await ctx.ui.custom<EditorAction>((tui, theme, _kb, done) => ({
      render(width: number) {
        const lines = renderEditor(config, phaseNames, selectedIndex).map((line) => line.slice(0, width));
        return lines.map((line, index) => {
          if (index === 0) return theme.fg("accent", theme.bold(line));
          if (line.startsWith("> ")) return theme.fg("accent", line);
          if (line.startsWith("Keys:")) return theme.fg("dim", line);
          return line;
        });
      },
      invalidate() {},
      handleInput(data: string) {
        if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
          done({ kind: ACTIONS.CANCEL });
          return;
        }
        if (matchesKey(data, "s")) {
          done({ kind: ACTIONS.SAVE });
          return;
        }
        if (matchesKey(data, "down")) {
          selectedIndex = selectedIndex < phaseNames.length - 1 ? selectedIndex + 1 : 0;
          tui.requestRender();
          return;
        }
        if (matchesKey(data, "up")) {
          selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : phaseNames.length - 1;
          tui.requestRender();
          return;
        }
        const phaseName = phaseNames[selectedIndex];
        if (!phaseName) return;
        if (matchesKey(data, "enter")) {
          done({ kind: ACTIONS.EDIT_MODEL, phaseName });
          return;
        }
        if (matchesKey(data, "e")) {
          done({ kind: ACTIONS.EDIT_THINKING, phaseName });
          return;
        }
        if (matchesKey(data, "c")) {
          done({ kind: ACTIONS.EDIT_CAVEMAN_OUTPUT, phaseName });
        }
      },
    }), {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: "80%",
        minWidth: 88,
        maxHeight: "85%",
      },
    });

    if (action.kind === ACTIONS.CANCEL) {
      return dirty ? "Model editor closed without saving changes." : "Model editor closed.";
    }

    if (action.kind === ACTIONS.SAVE) {
      const targetPath = await saveModelOverrides(ctx.cwd, config);
      return `Saved model overrides to ${path.relative(ctx.cwd, targetPath)}`;
    }

    if (!action.phaseName) {
      continue;
    }

    const phase = config.phases[action.phaseName];
    if (!phase) {
      continue;
    }

    if (action.kind === ACTIONS.EDIT_MODEL) {
      const selection = await ctx.ui.select(
        `Select model for ${action.phaseName}`,
        ["inherit", ...availableModels.map((model) => `${model.id}${model.reasoning ? " (supports thinking)" : ""}`)],
      );
      if (!selection) continue;
      phase.model = selection === "inherit" ? "inherit" : selection.replace(" (supports thinking)", "");
      if (phase.model !== "inherit") {
        const picked = availableModels.find((model) => model.id === phase.model);
        if (picked && !picked.reasoning) {
          phase.thinking = "inherit";
        }
      }
      dirty = true;
      continue;
    }

    if (action.kind === ACTIONS.EDIT_THINKING) {
      const picked = availableModels.find((model) => model.id === phase.model);
      if (phase.model !== "inherit" && picked && !picked.reasoning) {
        ctx.ui.notify(`Model ${phase.model} does not support thinking effort.`, "warning");
        continue;
      }

      const selection = await ctx.ui.select(
        `Select thinking level for ${action.phaseName}`,
        [...THINKING_LEVELS],
      );
      if (!selection) continue;
      phase.thinking = selection;
      dirty = true;
      continue;
    }

    if (action.kind === ACTIONS.EDIT_CAVEMAN_OUTPUT) {
      const selection = await ctx.ui.select(
        `Select caveman-output for ${action.phaseName}`,
        [...CAVEMAN_OUTPUT_LEVELS],
      );
      if (!selection) continue;
      phase["caveman-output"] = selection;
      dirty = true;
    }
  }
}

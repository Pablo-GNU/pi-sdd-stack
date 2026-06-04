import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describeTddMode, hasExplicitTddMode, readTddMode, TDD_MODES, type TddMode, writeTddMode } from "../testing/tddMode.js";

export async function runTddMode(cwd: string): Promise<string> {
  const mode = await readTddMode(cwd);
  return `Current TDD mode: ${mode}\n${describeTddMode(mode)}`;
}

export async function chooseTddMode(ctx: ExtensionCommandContext): Promise<string> {
  const current = await readTddMode(ctx.cwd);
  const selection = await ctx.ui.select(
    "Choose TDD mode for this project",
    [
      "1. strict — RED -> GREEN -> REFACTOR with explicit evidence in tasks/apply/verify",
      "2. standard — tests expected, but strict TDD is not enforced",
      "3. off — do not require tests from the stack",
    ],
  );

  if (!selection) {
    return `TDD mode unchanged: ${current}`;
  }

  const mode: TddMode = selection.startsWith("1.")
    ? TDD_MODES.STRICT
    : selection.startsWith("2.")
      ? TDD_MODES.STANDARD
      : TDD_MODES.OFF;

  await writeTddMode(ctx.cwd, mode);
  return `TDD mode set to ${mode}\n${describeTddMode(mode)}`;
}

export async function ensureTddModeChosen(ctx: ExtensionCommandContext): Promise<TddMode> {
  const alreadySet = await hasExplicitTddMode(ctx.cwd);
  if (alreadySet) {
    return readTddMode(ctx.cwd);
  }

  if (!ctx.hasUI) {
    await writeTddMode(ctx.cwd, TDD_MODES.STANDARD);
    return TDD_MODES.STANDARD;
  }

  const selection = await ctx.ui.select(
    "Choose TDD mode for this SDD flow",
    [
      "1. strict — RED -> GREEN -> REFACTOR with explicit evidence in tasks, apply, and verify",
      "2. standard — tests are expected, but strict TDD is not enforced",
      "3. off — the stack will not require tests",
    ],
  );

  const mode: TddMode = selection?.startsWith("1.")
    ? TDD_MODES.STRICT
    : selection?.startsWith("3.")
      ? TDD_MODES.OFF
      : TDD_MODES.STANDARD;

  await writeTddMode(ctx.cwd, mode);
  ctx.ui.notify(`TDD mode selected: ${mode}`, "info");
  return mode;
}

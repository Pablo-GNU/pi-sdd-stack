import path from "node:path";
import { homedir } from "node:os";
import { readYaml, writeYaml } from "../util/fs.js";

const TDD_MODES = {
  STRICT: "strict",
  STANDARD: "standard",
  OFF: "off",
} as const;

export type TddMode = (typeof TDD_MODES)[keyof typeof TDD_MODES];

interface StackSettings {
  testing?: {
    mode?: TddMode;
  };
}

function settingsPath(): string {
  const baseHome = process.env.PI_SDD_STACK_USER_HOME ?? homedir();
  return path.join(baseHome, ".pi", "sdd-stack", "settings.yaml");
}

export async function readTddMode(repoRoot: string): Promise<TddMode> {
  const settings = await readYaml<StackSettings>(settingsPath());
  const mode = settings?.testing?.mode;
  if (mode === TDD_MODES.STRICT || mode === TDD_MODES.STANDARD || mode === TDD_MODES.OFF) {
    return mode;
  }
  return TDD_MODES.STANDARD;
}

export async function hasExplicitTddMode(repoRoot: string): Promise<boolean> {
  const settings = await readYaml<StackSettings>(settingsPath());
  const mode = settings?.testing?.mode;
  return mode === TDD_MODES.STRICT || mode === TDD_MODES.STANDARD || mode === TDD_MODES.OFF;
}

export async function writeTddMode(repoRoot: string, mode: TddMode): Promise<void> {
  const current = (await readYaml<Record<string, unknown>>(settingsPath())) ?? {};
  const currentTesting = typeof current.testing === "object" && current.testing !== null ? current.testing as Record<string, unknown> : {};
  await writeYaml(settingsPath(), {
    ...current,
    testing: {
      ...currentTesting,
      mode,
    },
  });
}

export function describeTddMode(mode: TddMode): string {
  switch (mode) {
    case TDD_MODES.STRICT:
      return "Strict TDD: tasks, apply, and verify should follow RED -> GREEN -> REFACTOR with explicit evidence.";
    case TDD_MODES.STANDARD:
      return "Standard testing: tests are expected, but strict RED -> GREEN -> REFACTOR is not enforced.";
    case TDD_MODES.OFF:
      return "No TDD enforcement: the stack will not require tests, though verification artifacts may still be produced.";
  }
}

export { TDD_MODES };

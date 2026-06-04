import path from "node:path";
import { ensureDir, pathExists, readText, writeText } from "../util/fs.js";
import type { PhaseName } from "../models/phaseRoutes.js";
import { resolveProjectStatePaths } from "./projectState.js";

export interface RuntimeSessionRef {
  sessionId: string;
  sessionFile?: string;
}

export type DelegationStatus = "running" | "returned" | "failed";

export interface DelegationState {
  label: string;
  slug: string;
  phase: PhaseName;
  command: string;
  status: DelegationStatus;
  startedAt: string;
  updatedAt: string;
  note?: string;
}

export interface RuntimeState {
  session?: RuntimeSessionRef;
  active?: DelegationState;
  history: DelegationState[];
}

const LABEL_PARTS = {
  first: ["dog", "cat", "fox", "owl", "bear", "wolf", "otter", "crow"],
  second: ["fly", "run", "drift", "jump", "glow", "trace", "fold", "spark"],
  third: ["away", "slow", "fast", "bright", "north", "soft", "clear", "calm"],
} as const;

function emptyState(): RuntimeState {
  return { history: [] };
}

function buildLabelSeed(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick(arr: readonly string[], seed: number, shift: number): string {
  return arr[(Math.floor(seed / shift) % arr.length)]!;
}

export function createDelegationLabel(slug: string, phase: PhaseName, timestamp: string): string {
  const seed = buildLabelSeed(`${slug}:${phase}:${timestamp}`);
  return `${pick(LABEL_PARTS.first, seed, 1)}-${pick(LABEL_PARTS.second, seed, 7)}-${pick(LABEL_PARTS.third, seed, 49)}`;
}

function legacyRuntimeStatePath(repoRoot: string): string {
  return path.join(repoRoot, ".pi", "sdd-stack", "runtime-state.json");
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9-_]+/g, "-");
}

export async function runtimeStatePath(repoRoot: string, sessionId?: string): Promise<string> {
  const paths = await resolveProjectStatePaths(repoRoot);
  if (!sessionId) {
    return paths.runtimeStatePath;
  }

  return path.join(paths.baseDir, "sessions", sanitizeSessionId(sessionId), "runtime-state.json");
}

async function migrateLegacyRuntimeState(repoRoot: string, targetPath: string, session?: RuntimeSessionRef): Promise<void> {
  if (pathExists(targetPath)) {
    return;
  }

  const projectPath = await runtimeStatePath(repoRoot);
  const fallbackPaths = [legacyRuntimeStatePath(repoRoot), projectPath];

  for (const fallbackPath of fallbackPaths) {
    if (!pathExists(fallbackPath) || fallbackPath === targetPath) {
      continue;
    }

    const legacyContent = await readText(fallbackPath);
    if (!legacyContent) {
      continue;
    }

    let nextContent = legacyContent;
    if (session) {
      try {
        const parsed = JSON.parse(legacyContent) as RuntimeState;
        nextContent = `${JSON.stringify({ ...parsed, session: parsed.session ?? session }, null, 2)}\n`;
      } catch {
        nextContent = legacyContent.endsWith("\n") ? legacyContent : `${legacyContent}\n`;
      }
    } else if (!legacyContent.endsWith("\n")) {
      nextContent = `${legacyContent}\n`;
    }

    await ensureDir(path.dirname(targetPath));
    await writeText(targetPath, nextContent);
    return;
  }
}

export async function readRuntimeState(repoRoot: string, session?: RuntimeSessionRef): Promise<RuntimeState> {
  const targetPath = await runtimeStatePath(repoRoot, session?.sessionId);
  await migrateLegacyRuntimeState(repoRoot, targetPath, session);
  const content = await readText(targetPath);
  if (!content) {
    return emptyState();
  }

  try {
    const parsed = JSON.parse(content) as Partial<RuntimeState>;
    return {
      ...(parsed.session ? { session: parsed.session } : {}),
      ...(parsed.active ? { active: parsed.active } : {}),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return emptyState();
  }
}

async function writeRuntimeState(repoRoot: string, state: RuntimeState, session?: RuntimeSessionRef): Promise<void> {
  const targetPath = await runtimeStatePath(repoRoot, session?.sessionId ?? state.session?.sessionId);
  await ensureDir(path.dirname(targetPath));
  await writeText(targetPath, `${JSON.stringify(state, null, 2)}\n`);
}

function pushHistory(state: RuntimeState, entry: DelegationState): RuntimeState {
  return {
    ...(state.session ? { session: state.session } : {}),
    ...(state.active ? { active: state.active } : {}),
    history: [entry, ...state.history].slice(0, 25),
  };
}

export async function markDelegationRunning(repoRoot: string, entry: {
  session?: RuntimeSessionRef;
  label?: string;
  slug: string;
  phase: PhaseName;
  command: string;
}): Promise<DelegationState> {
  const now = new Date().toISOString();
  const next: DelegationState = {
    label: entry.label ?? createDelegationLabel(entry.slug, entry.phase, now),
    slug: entry.slug,
    phase: entry.phase,
    command: entry.command,
    status: "running",
    startedAt: now,
    updatedAt: now,
  };
  const state = await readRuntimeState(repoRoot, entry.session);
  await writeRuntimeState(repoRoot, {
    ...(entry.session ? { session: entry.session } : state.session ? { session: state.session } : {}),
    active: next,
    history: state.history,
  }, entry.session);
  return next;
}

export async function markDelegationReturned(repoRoot: string, note?: string, session?: RuntimeSessionRef): Promise<void> {
  const state = await readRuntimeState(repoRoot, session);
  if (!state.active) {
    return;
  }

  const updated: DelegationState = {
    ...state.active,
    status: "returned",
    updatedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };
  await writeRuntimeState(repoRoot, pushHistory({ ...(state.session ? { session: state.session } : {}), history: state.history }, updated), session);
}

export async function markDelegationFailed(repoRoot: string, note: string, session?: RuntimeSessionRef): Promise<void> {
  const state = await readRuntimeState(repoRoot, session);
  if (!state.active) {
    return;
  }

  const updated: DelegationState = {
    ...state.active,
    status: "failed",
    updatedAt: new Date().toISOString(),
    note,
  };
  await writeRuntimeState(repoRoot, pushHistory({ ...(state.session ? { session: state.session } : {}), history: state.history }, updated), session);
}

export async function findDelegationByLabel(repoRoot: string, label: string, session?: RuntimeSessionRef): Promise<DelegationState | undefined> {
  const state = await readRuntimeState(repoRoot, session);
  if (state.active?.label === label) {
    return state.active;
  }

  return state.history.find((entry) => entry.label === label);
}

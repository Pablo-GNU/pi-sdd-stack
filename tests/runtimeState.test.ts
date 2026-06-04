import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDir } from "./helpers.js";
import { PHASE_NAMES } from "../src/models/phaseRoutes.js";
import {
  createDelegationLabel,
  markDelegationFailed,
  markDelegationReturned,
  markDelegationRunning,
  readRuntimeState,
  runtimeStatePath,
} from "../src/sdd/runtimeState.js";
import { formatPhaseStatusesAsync } from "../src/sdd/orchestrator.js";

let stateHome: string;

const session = {
  sessionId: "pi-session-123",
  sessionFile: "/tmp/pi-session-123.jsonl",
};

describe("runtime phase state", () => {
  beforeEach(async () => {
    stateHome = await createTempDir("pi-sdd-home");
    vi.stubEnv("PI_SDD_STACK_HOME", stateHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds stable human labels", () => {
    const label = createDelegationLabel("add-dark-mode", PHASE_NAMES.PRD, "2026-06-04T20:00:00.000Z");
    expect(label).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(label).toBe(createDelegationLabel("add-dark-mode", PHASE_NAMES.PRD, "2026-06-04T20:00:00.000Z"));
  });

  it("tracks active delegation then archives returned entry", async () => {
    const repoRoot = await createTempDir("runtime-state");
    await markDelegationRunning(repoRoot, {
      session,
      slug: "add-dark-mode",
      phase: PHASE_NAMES.PRD,
      command: "/run pi-sdd-product \"task\"",
    });

    const active = await readRuntimeState(repoRoot, session);
    expect(active.active?.phase).toBe(PHASE_NAMES.PRD);
    expect(active.active?.label).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(active.history).toHaveLength(0);
    expect(active.session?.sessionId).toBe(session.sessionId);
    expect(await runtimeStatePath(repoRoot, session.sessionId)).toContain(`/sessions/${session.sessionId}/runtime-state.json`);
    expect(path.join(stateHome, ".pi", "sdd-stack", "state", "projects")).toBeTruthy();

    const status = await formatPhaseStatusesAsync(repoRoot, "add-dark-mode", session);
    expect(status).toContain("active-delegation:");
    expect(status).toContain(`- phase: ${PHASE_NAMES.PRD}`);
    expect(status).toContain(`- label: ${active.active?.label}`);

    await markDelegationReturned(repoRoot, "returned", session);
    const returned = await readRuntimeState(repoRoot, session);
    expect(returned.active).toBeUndefined();
    expect(returned.history[0]?.status).toBe("returned");
  });

  it("records failed delegation", async () => {
    const repoRoot = await createTempDir("runtime-fail");
    await markDelegationRunning(repoRoot, {
      session,
      slug: "add-dark-mode",
      phase: PHASE_NAMES.APPLY,
      command: "/run pi-sdd-writer \"task\"",
    });

    await markDelegationFailed(repoRoot, "boom", session);
    const state = await readRuntimeState(repoRoot, session);
    expect(state.active).toBeUndefined();
    expect(state.history[0]?.status).toBe("failed");
    expect(state.history[0]?.note).toBe("boom");
  });
});

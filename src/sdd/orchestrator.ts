import path from "node:path";
import { pathExists } from "../util/fs.js";
import { getChangePaths } from "../openspec/changePaths.js";
import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";
import { getPhaseNode, listPhaseGraph, type PhaseNode } from "./phaseGraph.js";
import { readVerifyStatus, VERIFY_STATUSES } from "./verifyStatus.js";

export interface PhaseStatus {
  phase: PhaseName;
  state: "completed" | "ready" | "blocked" | "not_applicable";
  reason: string;
}

function hasAnyDocumentation(repoRoot: string): boolean {
  return pathExists(path.join(repoRoot, "AGENTS.md")) || pathExists(path.join(repoRoot, "README.md"));
}

function phaseArtifactExists(repoRoot: string, slug: string, phase: PhaseName): boolean {
  const changePaths = getChangePaths(repoRoot, slug);
  switch (phase) {
    case PHASE_NAMES.BROWNFIELD_ONBOARD:
      return pathExists(path.join(repoRoot, "AGENTS.md"));
    case PHASE_NAMES.GREENFIELD_ONBOARD:
      return pathExists(path.join(repoRoot, "AGENTS.md")) || pathExists(path.join(repoRoot, "README.md"));
    case PHASE_NAMES.CURRENT_STATE_EXPLORE:
      return pathExists(changePaths.prd) || pathExists(changePaths.proposal) || hasAnyDocumentation(repoRoot);
    case PHASE_NAMES.DOCUMENTATION_REVIEW:
      return pathExists(path.join(repoRoot, "openspec")) || hasAnyDocumentation(repoRoot);
    case PHASE_NAMES.PRD:
      return pathExists(changePaths.prd);
    case PHASE_NAMES.SPEC:
      return pathExists(changePaths.specsDir);
    case PHASE_NAMES.DESIGN:
      return pathExists(changePaths.design);
    case PHASE_NAMES.TASKS:
      return pathExists(changePaths.tasks);
    case PHASE_NAMES.APPLY:
      return pathExists(path.join(changePaths.root, "apply-progress.md"));
    case PHASE_NAMES.VERIFY:
      return pathExists(changePaths.verify);
    case PHASE_NAMES.ARCHIVE:
      return pathExists(path.join(repoRoot, "openspec", "changes", "archive", slug)) || pathExists(path.join(repoRoot, "openspec", "changes", "archive", `${new Date().toISOString().slice(0, 10)}-${slug}`));
    case PHASE_NAMES.BUGFIX_MEMORY:
      return false;
  }
}

export function getPhaseStatuses(repoRoot: string, slug: string): PhaseStatus[] {
  const completed = new Set<PhaseName>();
  for (const node of listPhaseGraph()) {
    if (phaseArtifactExists(repoRoot, slug, node.phase)) {
      completed.add(node.phase);
    }
  }

  return listPhaseGraph().map((node) => buildPhaseStatus(node, completed));
}

function buildPhaseStatus(node: PhaseNode, completed: Set<PhaseName>): PhaseStatus {
  if (completed.has(node.phase)) {
    return { phase: node.phase, state: "completed", reason: "Artifacts or repository state already indicate this phase is covered." };
  }

  const missingDependencies = node.dependsOn.filter((dependency) => !completed.has(dependency));
  if (missingDependencies.length > 0) {
    return {
      phase: node.phase,
      state: "blocked",
      reason: `Waiting on: ${missingDependencies.join(", ")}`,
    };
  }

  const missingSoftDependencies = (node.softDependsOn ?? []).filter((dependency) => !completed.has(dependency));
  if (missingSoftDependencies.length > 0) {
    return {
      phase: node.phase,
      state: "ready",
      reason: `${node.purpose} Recommended before or during this phase: ${missingSoftDependencies.join(", ")}`,
    };
  }

  return {
    phase: node.phase,
    state: "ready",
    reason: node.purpose,
  };
}

export function getNextRecommendedPhase(repoRoot: string, slug: string): PhaseStatus | undefined {
  return getPhaseStatuses(repoRoot, slug).find((status) => status.state === "ready" && status.phase !== PHASE_NAMES.BROWNFIELD_ONBOARD && status.phase !== PHASE_NAMES.GREENFIELD_ONBOARD && status.phase !== PHASE_NAMES.DOCUMENTATION_REVIEW && status.phase !== PHASE_NAMES.CURRENT_STATE_EXPLORE);
}

export async function getNextRecommendedPhaseAsync(repoRoot: string, slug: string): Promise<PhaseStatus | undefined> {
  const verifyStatus = await readVerifyStatus(repoRoot, slug);
  if (verifyStatus === VERIFY_STATUSES.FAIL) {
    return {
      phase: PHASE_NAMES.APPLY,
      state: "ready",
      reason: "Verify failed. Return to apply, fix the implementation issues, and rerun verify.",
    };
  }

  return getNextRecommendedPhase(repoRoot, slug);
}

export function formatPhaseStatuses(repoRoot: string, slug: string): string {
  const statuses = getPhaseStatuses(repoRoot, slug);
  const lines = [`pi-sdd-stack phase status for ${slug}`, "", "phases:"];

  for (const status of statuses) {
    lines.push(`- ${status.phase}: ${status.state} — ${status.reason}`);
  }

  const next = getNextRecommendedPhase(repoRoot, slug);
  if (next) {
    lines.push("", `next: ${next.phase}`);
  }

  return lines.join("\n");
}

export async function formatPhaseStatusesAsync(repoRoot: string, slug: string): Promise<string> {
  const statuses = getPhaseStatuses(repoRoot, slug);
  const lines = [`pi-sdd-stack phase status for ${slug}`, "", "phases:"];

  for (const status of statuses) {
    lines.push(`- ${status.phase}: ${status.state} — ${status.reason}`);
  }

  const next = await getNextRecommendedPhaseAsync(repoRoot, slug);
  if (next) {
    lines.push("", `next: ${next.phase}`);
  }

  return lines.join("\n");
}

import path from "node:path";
import { readYaml } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";
import type { MemoryPolicyConfig, MemoryWriteRequest } from "./memoryTypes.js";

export interface MemoryValidationResult {
  allowed: boolean;
  normalized: MemoryWriteRequest;
  error?: string;
}

const DOCUMENTATION_ARTIFACT_HINTS = [
  "readme",
  "agents.md",
  "claude.md",
  "project documentation",
  "documentación general",
  "onboarding guide",
  "prd",
  "proposal",
  "specification",
  "spec delta",
  "design doc",
  "design document",
  "tasks.md",
  "verify.md",
  "acceptance criteria",
] as const;

const AUTOMATED_CATEGORIES = {
  PRD: "prd",
  PROPOSAL: "proposal",
  SPEC: "spec",
  DESIGN: "design",
  TASKS: "tasks",
  FEATURE_REQUIREMENTS: "feature_requirements",
  ACCEPTANCE_CRITERIA: "acceptance_criteria",
  IMPLEMENTATION_PLAN: "implementation_plan_as_source_of_truth",
} as const;

export async function loadDefaultMemoryPolicy(moduleUrl: string): Promise<MemoryPolicyConfig> {
  const packageRoot = resolvePackageRoot(moduleUrl);
  const policy = await readYaml<MemoryPolicyConfig>(path.join(packageRoot, "assets", "policies", "memory-policy.default.yaml"));
  if (!policy) {
    throw new Error("Default memory policy asset is missing.");
  }
  return policy;
}

export function validateMemoryWrite(policy: MemoryPolicyConfig, request: MemoryWriteRequest): MemoryValidationResult {
  const normalized: MemoryWriteRequest = {
    ...request,
    capturePrompt: false,
  };

  if (policy.forbiddenWriteCategories.includes(request.category)) {
    return {
      allowed: false,
      normalized,
      error: "Blocked by pi-sdd-stack memory policy: PRDs, specs, designs and tasks belong in OpenSpec, not Engram. Save a compact bugfix/convention/handoff memory with references instead.",
    };
  }

  if (!policy.allowedWriteCategories.includes(request.category)) {
    return {
      allowed: false,
      normalized,
      error: `Blocked by pi-sdd-stack memory policy: category \"${request.category}\" is not allowed in strict mode.`,
    };
  }

  const combinedText = `${request.title}\n${request.summary}`.toLowerCase();
  if (DOCUMENTATION_ARTIFACT_HINTS.some((hint) => combinedText.includes(hint))) {
    return {
      allowed: false,
      normalized,
      error: "Blocked by pi-sdd-stack memory policy: project documentation, PRDs, specs, design docs, task lists, and verification artifacts belong in files, not Engram.",
    };
  }

  if (request.category === "bug_fix" && (!request.evidence?.length || !request.fix || !request.rootCause)) {
    return {
      allowed: false,
      normalized,
      error: "Blocked by pi-sdd-stack memory policy: bug_fix writes require rootCause, fix and evidence.",
    };
  }

  return { allowed: true, normalized };
}

export { AUTOMATED_CATEGORIES };

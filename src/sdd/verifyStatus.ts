import path from "node:path";
import { getChangePaths } from "../openspec/changePaths.js";
import { readText } from "../util/fs.js";

export const VERIFY_STATUSES = {
  PASS: "pass",
  WARNING: "warning",
  FAIL: "fail",
  NONE: "none",
} as const;

export type VerifyStatus = (typeof VERIFY_STATUSES)[keyof typeof VERIFY_STATUSES];

export interface VerifyAssessment {
  status: VerifyStatus;
  summary: string;
  recommendedNextPhase: "apply" | "archive";
  failures: string[];
  warnings: string[];
}

export async function assessVerifyStatus(repoRoot: string, slug: string): Promise<VerifyAssessment> {
  const changePaths = getChangePaths(repoRoot, slug);
  const tasksContent = await readText(changePaths.tasks);
  const applyProgressContent = await readText(path.join(changePaths.root, "apply-progress.md"));

  const failures: string[] = [];
  const warnings: string[] = [];

  if (!tasksContent) {
    failures.push("tasks.md is missing.");
  }

  if (!applyProgressContent) {
    failures.push("apply-progress.md is missing.");
  }

  if (tasksContent?.includes("- [ ]")) {
    failures.push("There are still unchecked implementation tasks.");
  }

  const lowerApply = applyProgressContent?.toLowerCase() ?? "";
  if (applyProgressContent && !lowerApply.includes("test")) {
    warnings.push("apply-progress.md does not mention test evidence yet.");
  }

  if (applyProgressContent && !lowerApply.includes("file")) {
    warnings.push("apply-progress.md does not mention changed file paths yet.");
  }

  if (failures.length > 0) {
    return {
      status: VERIFY_STATUSES.FAIL,
      summary: failures.join(" "),
      recommendedNextPhase: "apply",
      failures,
      warnings,
    };
  }

  if (warnings.length > 0) {
    return {
      status: VERIFY_STATUSES.WARNING,
      summary: warnings.join(" "),
      recommendedNextPhase: "archive",
      failures,
      warnings,
    };
  }

  return {
    status: VERIFY_STATUSES.PASS,
    summary: "Implementation evidence is present and no blocking verification issues were found.",
    recommendedNextPhase: "archive",
    failures,
    warnings,
  };
}

export async function readVerifyStatus(repoRoot: string, slug: string): Promise<VerifyStatus> {
  const changePaths = getChangePaths(repoRoot, slug);
  const content = await readText(changePaths.verify);
  if (!content) {
    return VERIFY_STATUSES.NONE;
  }

  const match = content.match(/^- Status:\s*(pass|warning|fail)$/mi);
  return (match?.[1] as VerifyStatus | undefined) ?? VERIFY_STATUSES.NONE;
}

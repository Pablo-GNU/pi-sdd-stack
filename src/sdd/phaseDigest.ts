import path from "node:path";
import { getChangePaths } from "../openspec/changePaths.js";
import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";
import { listDir, pathExists, readText } from "../util/fs.js";

function sectionBullets(content: string, limit = 4): string[] {
  return content
    .split("\n")
    .filter((line) => line.startsWith("## ") || line.startsWith("### "))
    .slice(0, limit)
    .map((line) => `- ${line.replace(/^###?\s+/, "")}`);
}

function checklistBullets(content: string, limit = 6): string[] {
  return content
    .split("\n")
    .filter((line) => /^\s*- \[[ x]\]/.test(line))
    .slice(0, limit)
    .map((line) => `- ${line.trim().replace(/^- \[[ x]\]\s*/, "")}`);
}

function requirementBullets(content: string, limit = 4): string[] {
  const lines = content
    .split("\n")
    .filter((line) => /^#+\s+/.test(line) || /^\*\*Requirement:\*\*/.test(line))
    .slice(0, limit);

  return lines.map((line) => `- ${line.replace(/^#+\s+/, "").replace(/^\*\*Requirement:\*\*\s*/, "")}`);
}

async function specDigest(repoRoot: string, slug: string): Promise<string | undefined> {
  const paths = getChangePaths(repoRoot, slug);
  const proposal = await readText(paths.proposal);
  const domains = await listDir(paths.specsDir);
  const specSummaries: string[] = [];

  for (const domain of domains) {
    const specPath = path.join(paths.specsDir, domain, "spec.md");
    if (!pathExists(specPath)) {
      continue;
    }
    const content = await readText(specPath);
    if (!content) {
      continue;
    }
    const bullets = requirementBullets(content, 2);
    specSummaries.push(`- ${domain}${bullets.length > 0 ? `: ${bullets.map((item) => item.replace(/^-\s*/, "")).join(" / ")}` : ""}`);
  }

  if (!proposal && specSummaries.length === 0) {
    return undefined;
  }

  return [
    `Phase returned: ${PHASE_NAMES.SPEC}`,
    "spec decisions:",
    ...(proposal ? sectionBullets(proposal, 4) : ["- Proposal updated"]),
    "spec coverage:",
    ...(specSummaries.length > 0 ? specSummaries : ["- Delta specs updated"]),
    `review gate: if spec needs changes, rerun /sdd-stack:spec ${slug}. If spec is OK, continue with /sdd-stack:continue ${slug}.`,
  ].join("\n");
}

async function designDigest(repoRoot: string, slug: string): Promise<string | undefined> {
  const content = await readText(getChangePaths(repoRoot, slug).design);
  if (!content) {
    return undefined;
  }

  return [
    `Phase returned: ${PHASE_NAMES.DESIGN}`,
    "design decisions:",
    ...sectionBullets(content, 6),
    `review gate: if design needs changes, rerun /sdd-stack:design ${slug}. If design is OK, continue with /sdd-stack:continue ${slug}.`,
  ].join("\n");
}

async function tasksDigest(repoRoot: string, slug: string): Promise<string | undefined> {
  const content = await readText(getChangePaths(repoRoot, slug).tasks);
  if (!content) {
    return undefined;
  }

  return [
    `Phase returned: ${PHASE_NAMES.TASKS}`,
    "tasks ready for apply:",
    ...checklistBullets(content, 8),
    `review gate: if tasks need changes, rerun /sdd-stack:tasks ${slug}. If tasks are OK, start implementation with /sdd-stack:apply ${slug}.`,
  ].join("\n");
}

export async function buildPhaseReturnDigest(repoRoot: string, slug: string, phase: PhaseName): Promise<string | undefined> {
  if (phase === PHASE_NAMES.SPEC) {
    return specDigest(repoRoot, slug);
  }

  if (phase === PHASE_NAMES.DESIGN) {
    return designDigest(repoRoot, slug);
  }

  if (phase === PHASE_NAMES.TASKS) {
    return tasksDigest(repoRoot, slug);
  }

  return undefined;
}

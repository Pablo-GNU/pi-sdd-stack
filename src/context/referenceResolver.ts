import path from "node:path";
import { listDir, pathExists, readText } from "../util/fs.js";
import type { ProjectScanResult } from "../init/projectProfile.js";
import { DEFAULT_REFERENCE_POLICY } from "./referencePolicy.js";

export interface RecommendedRead {
  path: string;
  reason: string;
  required: boolean;
}

export interface ReferenceResolution {
  task: string;
  phase: string;
  recommendedReads: RecommendedRead[];
  avoidBulkReads: string[];
}

async function collectSpecReads(repoRoot: string, slug: string): Promise<RecommendedRead[]> {
  const reads: RecommendedRead[] = [];
  const prdPath = path.join(repoRoot, "openspec", "changes", slug, "prd.md");
  if (pathExists(prdPath)) {
    reads.push({ path: path.relative(repoRoot, prdPath), reason: "PRD for current change", required: true });
  }

  const specsRoot = path.join(repoRoot, "openspec", "specs");
  if (!pathExists(specsRoot)) {
    return reads;
  }

  const domains = await listDir(specsRoot);
  for (const domain of domains.slice(0, 8)) {
    const specPath = path.join(specsRoot, domain, "spec.md");
    const content = await readText(specPath);
    if (!content) continue;
    if (content.toLowerCase().includes(slug.replaceAll("-", " ")) || domain.includes(slug.split("-")[0] ?? "")) {
      reads.push({ path: path.relative(repoRoot, specPath), reason: `Existing ${domain} behavior may be affected`, required: false });
    }
  }

  return reads;
}

export async function resolveReferences(options: {
  repoRoot: string;
  slug: string;
  phase: string;
  projectProfile?: ProjectScanResult;
}): Promise<ReferenceResolution> {
  const recommendedReads = await collectSpecReads(options.repoRoot, options.slug);

  if (recommendedReads.length === 0 && options.projectProfile) {
    recommendedReads.push(
      ...options.projectProfile.notablePaths.slice(0, 3).map((entry) => ({
        path: entry.path,
        reason: "Project layout reference",
        required: false,
      })),
    );
  }

  return {
    task: `${options.phase} ${options.slug}`,
    phase: options.phase,
    recommendedReads,
    avoidBulkReads: DEFAULT_REFERENCE_POLICY.avoidBulkReads,
  };
}

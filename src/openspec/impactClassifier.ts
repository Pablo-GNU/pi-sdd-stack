import path from "node:path";
import { listDir, pathExists, readText } from "../util/fs.js";

export const FEATURE_IMPACT_KIND = {
  NEW_DOMAIN: "new_domain",
  NEW_REQUIREMENT_EXISTING_DOMAIN: "new_requirement_existing_domain",
  MODIFIES_EXISTING_BEHAVIOR: "modifies_existing_behavior",
  REMOVES_EXISTING_BEHAVIOR: "removes_existing_behavior",
  CROSS_CUTTING_EXISTING_BEHAVIOR: "cross_cutting_existing_behavior",
  DOCUMENTATION_SYNC_NEEDED: "documentation_sync_needed",
  UNKNOWN: "unknown",
} as const;

export type FeatureImpactKind = (typeof FEATURE_IMPACT_KIND)[keyof typeof FEATURE_IMPACT_KIND];

export interface ExistingRequirement {
  specPath: string;
  heading: string;
}

export interface FeatureImpactClassification {
  changeSlug: string;
  kind: FeatureImpactKind;
  affectedDomains: string[];
  existingSpecPaths: string[];
  existingRequirements: ExistingRequirement[];
  newDomainsNeeded: string[];
  docActions: Array<
    | "create_change"
    | "create_prd"
    | "create_delta_spec"
    | "update_delta_spec"
    | "create_new_domain_delta_spec"
    | "do_not_edit_source_specs_until_archive"
    | "recommend_brownfield_refresh"
  >;
  confidence: "low" | "medium" | "high";
  notes: string[];
}

function headingMatches(content: string, keyword: string): string[] {
  return content
    .split("\n")
    .filter((line) => line.startsWith("### Requirement:") && line.toLowerCase().includes(keyword.toLowerCase()))
    .map((line) => line.replace("### ", ""));
}

export async function classifyFeatureImpact(options: {
  repoRoot: string;
  changeSlug: string;
  requestedDomains?: string[];
  summary?: string;
}): Promise<FeatureImpactClassification> {
  const specsRoot = path.join(options.repoRoot, "openspec", "specs");
  const requestedDomains = options.requestedDomains ?? [];
  const summary = options.summary?.toLowerCase() ?? options.changeSlug.toLowerCase();
  const domains = pathExists(specsRoot) ? await listDir(specsRoot) : [];
  const affectedDomains: string[] = [];
  const existingSpecPaths: string[] = [];
  const existingRequirements: ExistingRequirement[] = [];
  const newDomainsNeeded: string[] = [];

  for (const domain of domains) {
    const specPath = path.join(specsRoot, domain, "spec.md");
    const content = await readText(specPath);
    if (!content) continue;
    const relativePath = path.relative(options.repoRoot, specPath);
    const isExplicit = requestedDomains.includes(domain);
    const isReferenced = summary.includes(domain.replaceAll("-", " "));
    const matches = headingMatches(content, options.changeSlug.split("-")[0] ?? "");

    if (isExplicit || isReferenced || matches.length > 0) {
      affectedDomains.push(domain);
      existingSpecPaths.push(relativePath);
      existingRequirements.push(...matches.map((heading) => ({ specPath: relativePath, heading })));
    }
  }

  for (const domain of requestedDomains) {
    if (!domains.includes(domain)) {
      newDomainsNeeded.push(domain);
    }
  }

  let kind: FeatureImpactKind = FEATURE_IMPACT_KIND.UNKNOWN;
  const docActions: FeatureImpactClassification["docActions"] = [
    "create_change",
    "create_prd",
    "do_not_edit_source_specs_until_archive",
  ];

  if (summary.includes("remove") || summary.includes("deprecat")) {
    kind = FEATURE_IMPACT_KIND.REMOVES_EXISTING_BEHAVIOR;
    docActions.push("update_delta_spec");
  } else if (affectedDomains.length > 1 || requestedDomains.length > 1) {
    kind = FEATURE_IMPACT_KIND.CROSS_CUTTING_EXISTING_BEHAVIOR;
    docActions.push("update_delta_spec");
  } else if (existingRequirements.length > 0 || summary.includes("modify") || summary.includes("update")) {
    kind = FEATURE_IMPACT_KIND.MODIFIES_EXISTING_BEHAVIOR;
    docActions.push("update_delta_spec");
  } else if (affectedDomains.length === 1) {
    kind = FEATURE_IMPACT_KIND.NEW_REQUIREMENT_EXISTING_DOMAIN;
    docActions.push("create_delta_spec");
  } else if (newDomainsNeeded.length > 0 || requestedDomains.length > 0) {
    kind = FEATURE_IMPACT_KIND.NEW_DOMAIN;
    docActions.push("create_new_domain_delta_spec");
  }

  if (summary.includes("drift") || summary.includes("docs disagree") || summary.includes("brownfield")) {
    kind = FEATURE_IMPACT_KIND.DOCUMENTATION_SYNC_NEEDED;
    docActions.push("recommend_brownfield_refresh");
  }

  return {
    changeSlug: options.changeSlug,
    kind,
    affectedDomains,
    existingSpecPaths,
    existingRequirements,
    newDomainsNeeded,
    docActions: [...new Set(docActions)],
    confidence: kind === FEATURE_IMPACT_KIND.UNKNOWN ? "low" : affectedDomains.length + newDomainsNeeded.length > 1 ? "medium" : "high",
    notes: kind === FEATURE_IMPACT_KIND.CROSS_CUTTING_EXISTING_BEHAVIOR
      ? ["Feature appears to touch multiple existing domains."]
      : kind === FEATURE_IMPACT_KIND.MODIFIES_EXISTING_BEHAVIOR
        ? ["Existing behavior should be captured under MODIFIED requirements."]
        : kind === FEATURE_IMPACT_KIND.NEW_DOMAIN
          ? ["Create a new domain delta spec within the active change."]
          : [],
  };
}

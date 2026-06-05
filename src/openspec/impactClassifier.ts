import path from "node:path";
import { listDir, pathExists, readText } from "../util/fs.js";
import { readRequestedDomainsForChange } from "./requestedDomains.js";

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

const GENERIC_CHANGE_TOKENS = new Set([
  "add",
  "create",
  "new",
  "update",
  "modify",
  "change",
  "remove",
  "delete",
  "fix",
  "docs",
  "documentation",
  "sync",
  "feature",
  "flow",
]);

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function singularizeToken(value: string): string {
  if (value.endsWith("ies") && value.length > 3) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("ses") && value.length > 3) {
    return value.slice(0, -2);
  }

  if (value.endsWith("s") && !value.endsWith("ss") && value.length > 1) {
    return value.slice(0, -1);
  }

  return value;
}

function tokenizeSummary(value: string): string[] {
  return value
    .split(/[^a-z0-9-]+/i)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 1 && !GENERIC_CHANGE_TOKENS.has(token));
}

function buildTokenAliases(value: string): Set<string> {
  const normalized = normalizeToken(value);
  const singular = singularizeToken(normalized);
  return new Set([normalized, singular, singular.endsWith("s") ? singular : `${singular}s`].filter((token) => token.length > 0));
}

function domainMatchesSummary(domain: string, summaryTokens: string[]): boolean {
  const domainParts = domain.split("-").flatMap((part) => Array.from(buildTokenAliases(part)));
  return domainParts.some((part) => summaryTokens.includes(part));
}

function headingMatches(content: string, keywords: string[]): string[] {
  const strongKeywords = keywords.filter((keyword) => keyword.length >= 4);
  if (strongKeywords.length === 0) {
    return [];
  }

  return content
    .split("\n")
    .filter((line) => line.startsWith("### Requirement:"))
    .filter((line) => strongKeywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())))
    .map((line) => line.replace("### ", ""));
}

export async function classifyFeatureImpact(options: {
  repoRoot: string;
  changeSlug: string;
  requestedDomains?: string[];
  summary?: string;
}): Promise<FeatureImpactClassification> {
  const specsRoot = path.join(options.repoRoot, "openspec", "specs");
  const requestedDomains = options.requestedDomains ?? await readRequestedDomainsForChange(options.repoRoot, options.changeSlug);
  const summary = options.summary?.toLowerCase() ?? options.changeSlug.toLowerCase();
  const summaryTokens = tokenizeSummary(summary);
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
    const isReferenced = domainMatchesSummary(domain, summaryTokens) || summary.includes(domain.replaceAll("-", " "));
    const matches = headingMatches(content, summaryTokens.filter((token) => token !== domain && token !== singularizeToken(domain)));

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
        ? [
            requestedDomains.length > 0 ? `requestedDomains=${requestedDomains.join(", ")} from prd.md takes priority over slug/summary heuristics.` : "",
            "Existing behavior should be captured under MODIFIED requirements.",
            "Use MODIFIED when the change alters the semantics, constraints, or scenarios of an already specified requirement.",
          ].filter(Boolean)
        : kind === FEATURE_IMPACT_KIND.NEW_REQUIREMENT_EXISTING_DOMAIN
          ? [
              requestedDomains.length > 0 ? `requestedDomains=${requestedDomains.join(", ")} from prd.md takes priority over slug/summary heuristics.` : "",
              "Follow-up change extends an existing domain. Reuse the existing domain delta spec path inside the active change.",
              "Use ADDED when the capability is net-new inside an existing domain. Use MODIFIED only when changing an existing requirement's semantics, constraints, or scenarios.",
            ].filter(Boolean)
          : kind === FEATURE_IMPACT_KIND.NEW_DOMAIN
            ? [
                requestedDomains.length > 0 ? `requestedDomains=${requestedDomains.join(", ")} from prd.md takes priority over slug/summary heuristics.` : "",
                "Create a new domain delta spec within the active change.",
              ].filter(Boolean)
            : [],
  };
}

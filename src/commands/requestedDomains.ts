import path from "node:path";
import { PHASE_NAMES } from "../models/phaseRoutes.js";
import { prepareOpenSpecArtifacts } from "../openspec/changeScaffolding.js";
import { readRequestedDomainsForChange, writeRequestedDomainsForChange } from "../openspec/requestedDomains.js";

function parseDomains(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function formatDomains(domains: string[]): string {
  return domains.length > 0 ? domains.join(", ") : "(none)";
}

export async function runRequestedDomains(cwd: string, args: string): Promise<string> {
  const trimmed = args.trim();
  if (!trimmed) {
    throw new Error("Missing change slug. Usage: /sdd-stack:requested-domains <slug> [domain1,domain2,...|--clear]");
  }

  const firstSpace = trimmed.indexOf(" ");
  const slug = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace).trim();
  const rawDomains = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();

  await prepareOpenSpecArtifacts(cwd, slug, PHASE_NAMES.PRD);

  if (!rawDomains) {
    const domains = await readRequestedDomainsForChange(cwd, slug);
    return [
      `slug=${slug}`,
      `prd=${path.join("openspec", "changes", slug, "prd.md")}`,
      `requestedDomains=${formatDomains(domains)}`,
      `usage= /sdd-stack:requested-domains ${slug} domain1,domain2 or /sdd-stack:requested-domains ${slug} --clear`,
    ].join("\n");
  }

  const nextDomains = rawDomains === "--clear" ? [] : parseDomains(rawDomains);
  const result = await writeRequestedDomainsForChange(cwd, slug, nextDomains);

  return [
    `slug=${slug}`,
    `prd=${path.join("openspec", "changes", slug, "prd.md")}`,
    `requestedDomains=${formatDomains(result.domains)}`,
    `status=${result.updated ? "updated" : "unchanged"}`,
  ].join("\n");
}

import path from "node:path";
import { getChangePaths } from "../openspec/changePaths.js";
import { prepareOpenSpecArtifacts } from "../openspec/changeScaffolding.js";
import { readRequestedDomainsForChange } from "../openspec/requestedDomains.js";
import { PHASE_NAMES } from "../models/phaseRoutes.js";

export async function runPrd(cwd: string, slug: string): Promise<string> {
  await prepareOpenSpecArtifacts(cwd, slug, PHASE_NAMES.PRD);
  const paths = getChangePaths(cwd, slug);
  const requestedDomains = await readRequestedDomainsForChange(cwd, slug);

  return [
    path.relative(cwd, paths.prd),
    requestedDomains.length > 0
      ? `requestedDomains=${requestedDomains.join(", ")}`
      : `hint: if domain selection is ambiguous, set /sdd-stack:requested-domains ${slug} domain1,domain2`,
  ].join("\n");
}

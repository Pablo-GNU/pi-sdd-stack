import { classifyFeatureImpact } from "../openspec/impactClassifier.js";
import { prepareOpenSpecArtifacts } from "../openspec/changeScaffolding.js";
import { readRequestedDomainsForChange } from "../openspec/requestedDomains.js";
import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";
import { buildPhaseReturnDigest } from "../sdd/phaseDigest.js";
import { describeTddMode, readTddMode } from "../testing/tddMode.js";

export async function runPlan(cwd: string, slug: string, phase: PhaseName = PHASE_NAMES.SPEC): Promise<string> {
  const impact = await classifyFeatureImpact({ repoRoot: cwd, changeSlug: slug, summary: slug });
  const tddMode = await readTddMode(cwd);
  const requestedDomains = await readRequestedDomainsForChange(cwd, slug);
  await prepareOpenSpecArtifacts(cwd, slug, phase);

  const digest = await buildPhaseReturnDigest(cwd, slug, phase);
  return [
    `impact=${impact.kind}`,
    `tdd-mode=${tddMode}`,
    `phase=${phase}`,
    `requestedDomains=${requestedDomains.length > 0 ? requestedDomains.join(", ") : "(heuristic)"}`,
    ...(requestedDomains.length === 0 ? [`hint=/sdd-stack:requested-domains ${slug} domain1,domain2 if spec domain selection is ambiguous`] : []),
    describeTddMode(tddMode),
    ...(digest ? ["", digest] : []),
  ].join("\n");
}

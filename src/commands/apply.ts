import { resolveReferences } from "../context/referenceResolver.js";
import { createGuidedPlan } from "../subagents/subagentRunner.js";
import { scanProject } from "../init/projectScanner.js";
import { describeTddMode, readTddMode } from "../testing/tddMode.js";

export async function runApply(cwd: string, slug: string): Promise<string> {
  const project = await scanProject(cwd);
  const tddMode = await readTddMode(cwd);
  const references = await resolveReferences({ repoRoot: project.root, slug, phase: "apply", projectProfile: project });
  const guidedPlan = createGuidedPlan("apply", references.recommendedReads.map((read) => read.path));
  return JSON.stringify({
    mode: "guided",
    tddMode,
    tddExplanation: describeTddMode(tddMode),
    message: "v0.1 does not auto-implement tasks. Use these references and require evidence before checking items off.",
    references,
    guidedPlan,
  }, null, 2);
}

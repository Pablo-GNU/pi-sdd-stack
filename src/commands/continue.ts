import { runApply } from "./apply.js";
import { runArchive } from "./archive.js";
import { runPlan } from "./plan.js";
import { runPrd } from "./prd.js";
import { runVerify } from "./verify.js";
import { getNextRecommendedPhaseAsync } from "../sdd/orchestrator.js";
import { PHASE_NAMES } from "../models/phaseRoutes.js";

export async function runContinue(cwd: string, slug: string): Promise<string> {
  const next = await getNextRecommendedPhaseAsync(cwd, slug);
  if (!next) {
    return `No next phase is ready for ${slug}. Run /sdd-stack:status ${slug} to inspect the graph.`;
  }

  switch (next.phase) {
    case PHASE_NAMES.PRD:
      return `phase=${next.phase}\n${await runPrd(cwd, slug)}`;
    case PHASE_NAMES.SPEC:
    case PHASE_NAMES.DESIGN:
    case PHASE_NAMES.TASKS:
      return `phase=${next.phase}\n${await runPlan(cwd, slug)}`;
    case PHASE_NAMES.APPLY:
      return `phase=${next.phase}\n${await runApply(cwd, slug)}`;
    case PHASE_NAMES.VERIFY:
      return `phase=${next.phase}\n${await runVerify(cwd, slug)}`;
    case PHASE_NAMES.ARCHIVE:
      return `phase=${next.phase}\n${await runArchive(cwd, slug)}`;
    default:
      return `Phase ${next.phase} is modeled but not directly runnable from /sdd-stack:continue.`;
  }
}

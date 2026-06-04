import { formatPhaseStatusesAsync } from "../sdd/orchestrator.js";
import type { RuntimeSessionRef } from "../sdd/runtimeState.js";

export async function runStatus(cwd: string, slug: string, session?: RuntimeSessionRef): Promise<string> {
  return formatPhaseStatusesAsync(cwd, slug, session);
}

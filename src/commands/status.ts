import { formatPhaseStatusesAsync } from "../sdd/orchestrator.js";

export async function runStatus(cwd: string, slug: string): Promise<string> {
  return formatPhaseStatusesAsync(cwd, slug);
}

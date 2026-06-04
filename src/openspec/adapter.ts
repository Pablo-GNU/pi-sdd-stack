import path from "node:path";
import { pathExists } from "../util/fs.js";
import { getChangePaths } from "./changePaths.js";

export function getTemplatePath(repoRoot: string, slug: string, artifact: "prd" | "proposal" | "design" | "tasks" | "verify"): string {
  const changePaths = getChangePaths(repoRoot, slug);
  return changePaths[artifact];
}

export async function hasOpenSpecCli(repoRoot: string): Promise<boolean> {
  return pathExists(path.join(repoRoot, "node_modules", ".bin", "openspec")) || pathExists(path.join(repoRoot, "openspec"));
}

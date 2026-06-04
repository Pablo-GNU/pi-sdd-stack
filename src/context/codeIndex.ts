import path from "node:path";
import { listDir, pathExists } from "../util/fs.js";

export interface CodeIndexEntry {
  path: string;
  kind: "dir" | "file";
}

export async function buildShallowCodeIndex(root: string): Promise<CodeIndexEntry[]> {
  const targets = ["src", "app", "apps", "packages", "services", "tests"];
  const entries: CodeIndexEntry[] = [];

  for (const target of targets) {
    const targetPath = path.join(root, target);
    if (!pathExists(targetPath)) continue;
    entries.push({ path: target, kind: "dir" });
    const children = await listDir(targetPath);
    for (const child of children.slice(0, 20)) {
      entries.push({ path: path.join(target, child), kind: "file" });
    }
  }

  return entries;
}

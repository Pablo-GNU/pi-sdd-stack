import path from "node:path";
import { pathExists } from "./fs.js";

export async function findGitRoot(startPath: string): Promise<string | undefined> {
  let current = path.resolve(startPath);

  while (true) {
    if (pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

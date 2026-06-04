import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolvePackageRoot(moduleUrl: string): string {
  const currentFile = fileURLToPath(moduleUrl);
  const currentDir = path.dirname(currentFile);

  if (currentDir.includes(`${path.sep}dist${path.sep}`)) {
    return currentDir.slice(0, currentDir.indexOf(`${path.sep}dist${path.sep}`));
  }

  if (currentDir.includes(`${path.sep}src${path.sep}`)) {
    return currentDir.slice(0, currentDir.indexOf(`${path.sep}src${path.sep}`));
  }

  return path.resolve(currentDir, "..");
}

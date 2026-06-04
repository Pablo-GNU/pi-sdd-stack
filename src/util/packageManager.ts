import path from "node:path";
import { pathExists } from "./fs.js";

const PACKAGE_MANAGERS = {
  PNPM: "pnpm",
  NPM: "npm",
  YARN: "yarn",
  BUN: "bun",
} as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[keyof typeof PACKAGE_MANAGERS];

export function detectPackageManager(root: string): PackageManager | undefined {
  if (pathExists(path.join(root, "pnpm-lock.yaml"))) return PACKAGE_MANAGERS.PNPM;
  if (pathExists(path.join(root, "yarn.lock"))) return PACKAGE_MANAGERS.YARN;
  if (pathExists(path.join(root, "bun.lockb"))) return PACKAGE_MANAGERS.BUN;
  if (pathExists(path.join(root, "package-lock.json")) || pathExists(path.join(root, "package.json"))) {
    return PACKAGE_MANAGERS.NPM;
  }

  return undefined;
}

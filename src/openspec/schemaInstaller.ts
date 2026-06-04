import path from "node:path";
import { ensureDir, listDir, pathExists, readText, writeText, writeYaml } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";

export interface SchemaInstallOptions {
  repoRoot: string;
  force?: boolean;
  skipOpenSpec?: boolean;
}

export interface SchemaInstallResult {
  schemaPath?: string;
  configPath?: string;
  installedFiles: string[];
  skipped: boolean;
}

async function copyRecursive(sourceRoot: string, targetRoot: string, force = false, installedFiles: string[] = []): Promise<string[]> {
  await ensureDir(targetRoot);
  const entries = await listDir(sourceRoot);

  for (const entry of entries) {
    const sourcePath = path.join(sourceRoot, entry);
    const targetPath = path.join(targetRoot, entry);
    if ((await readText(sourcePath)) === undefined) {
      await copyRecursive(sourcePath, targetPath, force, installedFiles);
      continue;
    }

    if (pathExists(targetPath) && !force) {
      continue;
    }

    const content = await readText(sourcePath);
    if (content !== undefined) {
      await writeText(targetPath, content);
      installedFiles.push(targetPath);
    }
  }

  return installedFiles;
}

export async function installOpenSpecSchema(moduleUrl: string, options: SchemaInstallOptions): Promise<SchemaInstallResult> {
  if (options.skipOpenSpec) {
    return { installedFiles: [], skipped: true };
  }

  const packageRoot = resolvePackageRoot(moduleUrl);
  const sourceRoot = path.join(packageRoot, "assets", "openspec-schema", "pi-sdd-stack");
  const targetRoot = path.join(options.repoRoot, "openspec", "schemas", "pi-sdd-stack");
  const installedFiles = await copyRecursive(sourceRoot, targetRoot, options.force);
  const configPath = path.join(options.repoRoot, "openspec", "config.yaml");

  if (!pathExists(configPath)) {
    await writeYaml(configPath, {
      version: 1,
      defaultSchema: "pi-sdd-stack",
      schemas: {
        "pi-sdd-stack": "./schemas/pi-sdd-stack/schema.yaml",
      },
    });
    installedFiles.push(configPath);
  }

  return { schemaPath: targetRoot, configPath, installedFiles, skipped: false };
}

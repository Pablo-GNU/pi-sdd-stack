import { mkdir, readFile, stat, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import YAML from "yaml";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export function pathExists(targetPath: string): boolean {
  return existsSync(targetPath);
}

export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function readText(targetPath: string): Promise<string | undefined> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return undefined;
  }
}

export async function writeText(targetPath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(targetPath));
  await writeFile(targetPath, content, "utf8");
}

export async function writeTextIfMissing(targetPath: string, content: string): Promise<boolean> {
  if (pathExists(targetPath)) {
    return false;
  }

  await writeText(targetPath, content);
  return true;
}

export async function writeYaml(targetPath: string, data: unknown): Promise<void> {
  await writeText(targetPath, YAML.stringify(data));
}

export async function readYaml<T>(targetPath: string): Promise<T | undefined> {
  const content = await readText(targetPath);
  if (!content) {
    return undefined;
  }

  return YAML.parse(content) as T;
}

export async function copyFileSafe(sourcePath: string, targetPath: string): Promise<void> {
  await ensureDir(path.dirname(targetPath));
  await copyFile(sourcePath, targetPath);
}

export async function listDir(targetPath: string): Promise<string[]> {
  try {
    return await readdir(targetPath);
  } catch {
    return [];
  }
}

import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { ensureDir, listDir, readText, writeText } from "../util/fs.js";
import { findGitRoot } from "../util/git.js";

export interface ProjectStateMetadata {
  projectId: string;
  repoName: string;
  gitRoot?: string;
  remoteUrl?: string;
  knownPaths: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStatePaths {
  baseDir: string;
  metadataPath: string;
  runtimeStatePath: string;
  historyDir: string;
  memoryDir: string;
  cacheDir: string;
  projectProfilePath: string;
  settingsPath: string;
}

function stateHome(): string {
  return process.env.PI_SDD_STACK_HOME || homedir();
}

function stateProjectsRoot(): string {
  return path.join(stateHome(), ".pi", "sdd-stack", "state", "projects");
}

function sanitizeRepoName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "project";
}

function shortHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function readGitRemote(gitRoot: string): string | undefined {
  const result = spawnSync("git", ["-C", gitRoot, "config", "--get", "remote.origin.url"], {
    encoding: "utf8",
    timeout: 3000,
    shell: false,
  });

  if (result.status !== 0) {
    return undefined;
  }

  const value = result.stdout.trim();
  return value.length > 0 ? value : undefined;
}

async function repoFacts(repoRoot: string): Promise<{
  repoName: string;
  realRepoRoot: string;
  gitRoot?: string;
  remoteUrl?: string;
}> {
  const realRepoRoot = await realpath(repoRoot).catch(() => path.resolve(repoRoot));
  const gitRoot = await findGitRoot(realRepoRoot);
  const remoteUrl = gitRoot ? readGitRemote(gitRoot) : undefined;
  return {
    repoName: path.basename(realRepoRoot),
    realRepoRoot,
    ...(gitRoot ? { gitRoot } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
  };
}

function buildProjectId(facts: {
  repoName: string;
  realRepoRoot: string;
  remoteUrl?: string;
}): string {
  const repoName = sanitizeRepoName(facts.repoName);
  const identity = facts.remoteUrl ? `remote:${facts.remoteUrl}` : `path:${facts.realRepoRoot}`;
  return `${repoName}-${shortHash(identity)}`;
}

function buildPaths(projectId: string): ProjectStatePaths {
  const baseDir = path.join(stateProjectsRoot(), projectId);
  return {
    baseDir,
    metadataPath: path.join(baseDir, "project.json"),
    runtimeStatePath: path.join(baseDir, "runtime-state.json"),
    historyDir: path.join(baseDir, "history"),
    memoryDir: path.join(baseDir, "memory"),
    cacheDir: path.join(baseDir, "cache"),
    projectProfilePath: path.join(baseDir, "project-profile.yaml"),
    settingsPath: path.join(baseDir, "settings.yaml"),
  };
}

async function readMetadata(metadataPath: string): Promise<ProjectStateMetadata | undefined> {
  const content = await readText(metadataPath);
  if (!content) {
    return undefined;
  }

  try {
    return JSON.parse(content) as ProjectStateMetadata;
  } catch {
    return undefined;
  }
}

function matchesProject(metadata: ProjectStateMetadata, facts: {
  realRepoRoot: string;
  gitRoot?: string;
  remoteUrl?: string;
}): boolean {
  if (facts.remoteUrl && metadata.remoteUrl === facts.remoteUrl) {
    return true;
  }

  return metadata.knownPaths.includes(facts.realRepoRoot)
    || Boolean(facts.gitRoot && metadata.knownPaths.includes(facts.gitRoot));
}

async function persistMetadata(metadataPath: string, metadata: ProjectStateMetadata): Promise<void> {
  await ensureDir(path.dirname(metadataPath));
  await writeText(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

export async function resolveProjectStatePaths(repoRoot: string): Promise<ProjectStatePaths> {
  const facts = await repoFacts(repoRoot);
  const projectsRoot = stateProjectsRoot();
  const entries = await listDir(projectsRoot);

  for (const entry of entries) {
    const candidate = buildPaths(entry);
    const metadata = await readMetadata(candidate.metadataPath);
    if (!metadata || !matchesProject(metadata, facts)) {
      continue;
    }

    const nextMetadata: ProjectStateMetadata = {
      ...metadata,
      repoName: sanitizeRepoName(facts.repoName),
      ...(facts.gitRoot ? { gitRoot: facts.gitRoot } : {}),
      ...(facts.remoteUrl ? { remoteUrl: facts.remoteUrl } : {}),
      knownPaths: [...new Set([...metadata.knownPaths, facts.realRepoRoot, ...(facts.gitRoot ? [facts.gitRoot] : [])])],
      updatedAt: new Date().toISOString(),
    };
    await persistMetadata(candidate.metadataPath, nextMetadata);
    return candidate;
  }

  const projectId = buildProjectId(facts);
  const paths = buildPaths(projectId);
  const now = new Date().toISOString();
  await persistMetadata(paths.metadataPath, {
    projectId,
    repoName: sanitizeRepoName(facts.repoName),
    ...(facts.gitRoot ? { gitRoot: facts.gitRoot } : {}),
    ...(facts.remoteUrl ? { remoteUrl: facts.remoteUrl } : {}),
    knownPaths: [...new Set([facts.realRepoRoot, ...(facts.gitRoot ? [facts.gitRoot] : [])])],
    createdAt: now,
    updatedAt: now,
  });
  return paths;
}

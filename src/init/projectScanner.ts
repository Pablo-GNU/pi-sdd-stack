import path from "node:path";
import { listDir, pathExists, readText } from "../util/fs.js";
import { findGitRoot } from "../util/git.js";
import { detectPackageManager } from "../util/packageManager.js";
import { CONFIDENCE, PROJECT_TYPES, type ProjectScanResult, type ProjectService } from "./projectProfile.js";

interface PackageJsonLike {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const SCRIPT_PURPOSES: Record<string, string> = {
  dev: "Start local development mode",
  build: "Build the project",
  test: "Run automated tests",
  lint: "Run lint checks",
  typecheck: "Run static type checks",
  start: "Start the application",
};

async function readPackageJson(root: string): Promise<PackageJsonLike | undefined> {
  const content = await readText(path.join(root, "package.json"));
  if (!content) return undefined;
  try {
    return JSON.parse(content) as PackageJsonLike;
  } catch {
    return undefined;
  }
}

function detectFrameworks(packageJson: PackageJsonLike | undefined): string[] {
  const deps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };
  const frameworks: string[] = [];
  const mapping: Array<[string, string]> = [
    ["next", "Next.js"],
    ["react", "React"],
    ["vue", "Vue"],
    ["@angular/core", "Angular"],
    ["svelte", "Svelte"],
    ["express", "Express"],
    ["fastify", "Fastify"],
    ["nestjs", "NestJS"],
    ["vitest", "Vitest"],
    ["jest", "Jest"],
  ];

  for (const [dependency, name] of mapping) {
    if (dependency in deps) frameworks.push(name);
  }

  return frameworks;
}

async function collectServices(root: string): Promise<ProjectService[]> {
  const buckets = ["apps", "packages", "services"];
  const services: ProjectService[] = [];

  for (const bucket of buckets) {
    const bucketPath = path.join(root, bucket);
    if (!(await pathExists(bucketPath))) continue;
    const entries = await listDir(bucketPath);

    for (const entry of entries) {
      const servicePath = path.join(bucketPath, entry);
      const packageJson = await readPackageJson(servicePath);
      const runtime = packageJson ? "node" : pathExists(path.join(servicePath, "pyproject.toml")) ? "python" : undefined;
      const service: ProjectService = {
        name: packageJson?.name ?? entry,
        path: path.relative(root, servicePath),
        purpose: "TODO",
      };
      if (runtime) {
        service.runtime = runtime;
      }
      services.push(service);
    }
  }

  return services;
}

function detectProjectType(root: string, services: ProjectService[], packageJson: PackageJsonLike | undefined): ProjectScanResult["projectType"] {
  if (
    pathExists(path.join(root, "pnpm-workspace.yaml")) ||
    pathExists(path.join(root, "turbo.json")) ||
    pathExists(path.join(root, "nx.json")) ||
    pathExists(path.join(root, "lerna.json")) ||
    pathExists(path.join(root, "rush.json")) ||
    services.length > 1
  ) {
    return PROJECT_TYPES.MONOREPO;
  }

  if (packageJson && packageJson.private === false) {
    return PROJECT_TYPES.LIBRARY;
  }

  if (services.length === 1) {
    return PROJECT_TYPES.SERVICE_COLLECTION;
  }

  if (packageJson || pathExists(path.join(root, "src"))) {
    return PROJECT_TYPES.SINGLE_APP;
  }

  return PROJECT_TYPES.UNKNOWN;
}

export async function scanProject(repoRoot: string): Promise<ProjectScanResult> {
  const root = (await findGitRoot(repoRoot)) ?? repoRoot;
  const packageJson = await readPackageJson(root);
  const services = await collectServices(root);
  const packageManager = detectPackageManager(root);
  const languages: string[] = [];
  const runtimes: string[] = [];
  const testing: string[] = [];
  const buildDeploy: string[] = [];

  if (packageJson || pathExists(path.join(root, "tsconfig.json"))) {
    languages.push("TypeScript");
    runtimes.push("Node.js");
  }
  if (pathExists(path.join(root, "pyproject.toml")) || pathExists(path.join(root, "requirements.txt"))) {
    languages.push("Python");
    runtimes.push("Python");
  }
  if (pathExists(path.join(root, "go.mod"))) {
    languages.push("Go");
    runtimes.push("Go");
  }
  if (pathExists(path.join(root, "Cargo.toml"))) {
    languages.push("Rust");
    runtimes.push("Rust");
  }

  const notableDirs = ["apps", "packages", "services", "src", "docs", "infra", ".github", "openspec"];
  const notablePaths = notableDirs
    .filter((dirName) => pathExists(path.join(root, dirName)))
    .map((dirName) => ({ path: dirName, purpose: "TODO" }));

  const envExamples = [".env.example", ".env.sample", ".env.local.example"]
    .filter((fileName) => pathExists(path.join(root, fileName)));

  if (pathExists(path.join(root, "Dockerfile")) || pathExists(path.join(root, "docker-compose.yml")) || pathExists(path.join(root, "compose.yaml"))) {
    buildDeploy.push("Docker");
  }

  const frameworks = detectFrameworks(packageJson);
  if (frameworks.includes("Vitest")) testing.push("Vitest");
  if (frameworks.includes("Jest")) testing.push("Jest");
  if (pathExists(path.join(root, "pytest.ini"))) testing.push("Pytest");

  const commands = Object.entries(packageJson?.scripts ?? {})
    .filter(([name]) => name in SCRIPT_PURPOSES)
    .map(([name]) => ({ command: `${packageManager ?? "npm"} run ${name}`, purpose: SCRIPT_PURPOSES[name] ?? "Project script" }));

  const result: ProjectScanResult = {
    root,
    projectName: packageJson?.name ?? path.basename(root),
    projectType: detectProjectType(root, services, packageJson),
    languages: [...new Set(languages)],
    frameworks,
    runtimes: [...new Set(runtimes)],
    services,
    commands,
    notablePaths,
    envExamples,
    testing,
    buildDeploy,
    confidence: services.length > 0 || Boolean(packageJson) ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
  };

  if (packageManager) {
    result.packageManager = packageManager;
  }

  return result;
}

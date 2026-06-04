import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { pathExists, readText } from "./fs.js";

const REQUIRED_PI_PACKAGES = {
  ASK_USER: "@juicesharp/rpiv-ask-user-question",
  TODO: "@juicesharp/rpiv-todo",
  SUBAGENTS: "pi-subagents",
} as const;

const REQUIRED_RUNTIME_IDS = {
  OPEN_SPEC: "openspec",
  ASK_USER: REQUIRED_PI_PACKAGES.ASK_USER,
  TODO: REQUIRED_PI_PACKAGES.TODO,
  SUBAGENTS: REQUIRED_PI_PACKAGES.SUBAGENTS,
} as const;

type RequiredRuntimeId = (typeof REQUIRED_RUNTIME_IDS)[keyof typeof REQUIRED_RUNTIME_IDS];

interface SettingsPackageObject {
  source?: string;
}

interface SettingsShape {
  packages?: Array<string | SettingsPackageObject>;
}

export interface RequirementStatus {
  id: RequiredRuntimeId;
  ok: boolean;
  install: string;
  reason: string;
}

export interface RequirementsReport {
  allOk: boolean;
  statuses: RequirementStatus[];
}

function isInstalledCommand(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    timeout: 5000,
    shell: false,
  });

  return result.status === 0;
}

async function readSettingsPackages(settingsPath: string): Promise<string[]> {
  if (!pathExists(settingsPath)) {
    return [];
  }

  const content = await readText(settingsPath);
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as SettingsShape;
    return (parsed.packages ?? []).flatMap((entry) => {
      if (typeof entry === "string") {
        return [entry];
      }

      return entry.source ? [entry.source] : [];
    });
  } catch {
    return [];
  }
}

async function getConfiguredPiPackages(repoRoot: string): Promise<string[]> {
  const globalSettings = path.join(homedir(), ".pi", "agent", "settings.json");
  const projectSettings = path.join(repoRoot, ".pi", "settings.json");
  const all = [
    ...(await readSettingsPackages(globalSettings)),
    ...(await readSettingsPackages(projectSettings)),
  ];

  return [...new Set(all)];
}

function hasPackage(configuredPackages: string[], packageName: string): boolean {
  return configuredPackages.some((entry) => entry.includes(packageName));
}

export async function inspectRequirements(repoRoot: string): Promise<RequirementsReport> {
  const configuredPackages = await getConfiguredPiPackages(repoRoot);
  const statuses: RequirementStatus[] = [
    {
      id: REQUIRED_RUNTIME_IDS.OPEN_SPEC,
      ok: isInstalledCommand("openspec"),
      install: "npm install -g @fission-ai/openspec@latest",
      reason: "OpenSpec CLI is required for spec navigation and lifecycle commands.",
    },
    {
      id: REQUIRED_RUNTIME_IDS.ASK_USER,
      ok: hasPackage(configuredPackages, REQUIRED_PI_PACKAGES.ASK_USER),
      install: "pi install npm:@juicesharp/rpiv-ask-user-question@latest",
      reason: "Structured clarification questions are required for PRD and planning phases.",
    },
    {
      id: REQUIRED_RUNTIME_IDS.TODO,
      ok: hasPackage(configuredPackages, REQUIRED_PI_PACKAGES.TODO),
      install: "pi install npm:@juicesharp/rpiv-todo@latest",
      reason: "Persistent todo tracking is required for tasks and apply flow discipline.",
    },
    {
      id: REQUIRED_RUNTIME_IDS.SUBAGENTS,
      ok: hasPackage(configuredPackages, REQUIRED_PI_PACKAGES.SUBAGENTS),
      install: "pi install npm:pi-subagents@latest",
      reason: "Subagent orchestration is required as part of the intended stack workflow.",
    },
  ];

  return {
    allOk: statuses.every((status) => status.ok),
    statuses,
  };
}

export async function assertRequirements(repoRoot: string): Promise<void> {
  const report = await inspectRequirements(repoRoot);
  if (report.allOk) {
    return;
  }

  const missing = report.statuses
    .filter((status) => !status.ok)
    .map((status) => `- Missing required dependency: ${status.id}\n  ${status.reason}\n  Install with: ${status.install}`)
    .join("\n");

  throw new Error(`pi-sdd-stack hard requirements are not satisfied:\n${missing}`);
}

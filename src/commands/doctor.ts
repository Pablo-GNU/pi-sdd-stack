import path from "node:path";
import { scanProject } from "../init/projectScanner.js";
import { pathExists } from "../util/fs.js";
import { inspectRequirements } from "../util/requirements.js";

export async function runDoctor(cwd: string): Promise<string> {
  const scan = await scanProject(cwd);
  const requirements = await inspectRequirements(scan.root);
  const lines = [
    `root: ${scan.root}`,
    `agents: ${pathExists(path.join(scan.root, "AGENTS.md")) ? "present" : "missing"}`,
    `openspec-config: ${pathExists(path.join(scan.root, "openspec", "config.yaml")) ? "present" : "missing"}`,
    `schema: ${pathExists(path.join(scan.root, "openspec", "schemas", "pi-sdd-stack", "schema.yaml")) ? "installed" : "missing"}`,
    `package-manager: ${scan.packageManager ?? "unknown"}`,
    `project-type: ${scan.projectType}`,
    `commands: ${scan.commands.map((command) => command.command).join(", ") || "none inferred"}`,
    `hard-requirements: ${requirements.statuses.map((status) => `${status.id}=${status.ok ? "ok" : "missing"}`).join(", ")}`,
  ];

  const missing = requirements.statuses.filter((status) => !status.ok);
  if (missing.length > 0) {
    lines.push("requirements-action:");
    lines.push(...missing.map((status) => `- install ${status.id}: ${status.install}`));
  }

  return lines.join("\n");
}

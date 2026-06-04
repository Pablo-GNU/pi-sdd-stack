import path from "node:path";
import { readText } from "../util/fs.js";
import { writeIfDifferent } from "./safeWrite.js";
import type { ProjectScanResult } from "./projectProfile.js";

function formatRows(rows: string[], fallback: string): string {
  return rows.length > 0 ? rows.join("\n") : fallback;
}

function renderList(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(", ") : fallback;
}

function templateValues(scan: ProjectScanResult): Record<string, string> {
  const hasOpenSpec = scan.notablePaths.some((entry) => entry.path === "openspec");
  return {
    projectName: scan.projectName || "TODO",
    projectType: scan.projectType,
    projectPurpose: "TODO",
    primaryUsers: "TODO",
    mainDomains: "TODO",
    repositoryLayoutRows: formatRows(
      scan.notablePaths.map((entry) => `| ${entry.path} | ${entry.purpose} |`),
      "| TODO | TODO |",
    ),
    serviceRows: formatRows(
      scan.services.map((service) => `| ${service.name} | ${service.path} | ${service.runtime ?? "TODO"} | ${service.purpose ?? "TODO"} |`),
      "| TODO | TODO | TODO | TODO |",
    ),
    languages: renderList(scan.languages, "TODO"),
    frameworks: renderList(scan.frameworks, "TODO"),
    packageManager: scan.packageManager ?? "TODO",
    runtime: renderList(scan.runtimes, "TODO"),
    storage: "TODO",
    queue: "TODO",
    testing: renderList(scan.testing, "TODO"),
    buildDeploy: renderList(scan.buildDeploy, "TODO"),
    commandRows: formatRows(
      scan.commands.map((command) => `| ${command.command} | ${command.purpose} |`),
      "| TODO | TODO |",
    ),
    operationalRules: [
      scan.envExamples[0] ? `- Env example: ${scan.envExamples[0]}` : "- Env example: TODO",
      "- Secret handling: never commit real secrets.",
      "- Avoid editing generated directories such as dist/, coverage/, node_modules/, or vendor/ unless explicitly required.",
    ].join("\n"),
    documentationMap: hasOpenSpec
      ? [
        "- Operational context: this file",
        "- Product/spec behavior: `openspec/specs/`",
        "- Active/planned changes: `openspec/changes/`",
        "- Targeted technical docs: check `docs/`, `api/docs/`, or app-specific notes if present",
      ].join("\n")
      : [
        "- Operational context: this file",
        "- Human onboarding: root `README.md` if present",
        "- Targeted technical docs: `docs/` or app/module notes if present",
      ].join("\n"),
    specsAndChanges: hasOpenSpec
      ? [
        "- Specs in force: `openspec/specs/`",
        "- Active changes: `openspec/changes/`",
        "- Archived changes: `openspec/changes/archive/`",
        "- Configuration: `openspec/config.yaml`",
      ].join("\n")
      : "- TODO if the project keeps specifications or change history outside the main codebase.",
    knownConstraints: "- TODO.",
  };
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
}

export async function generateAgentsFile(options: {
  repoRoot: string;
  scan: ProjectScanResult;
  templatePath: string;
  forceSuggestion?: boolean;
}): Promise<{ targetPath: string; status: "created" | "updated" | "unchanged"; mode: "primary" | "suggestion" }> {
  const template = await readText(options.templatePath);
  if (!template) {
    throw new Error(`AGENTS template not found at ${options.templatePath}`);
  }

  const content = fillTemplate(template, templateValues(options.scan));
  const primaryPath = path.join(options.repoRoot, "AGENTS.md");
  const suggestionPath = path.join(options.repoRoot, ".pi", "sdd-stack", "AGENTS.suggested.md");
  const useSuggestion = options.forceSuggestion || Boolean(await readText(primaryPath));

  const targetPath = useSuggestion ? suggestionPath : primaryPath;
  const mode = useSuggestion ? "suggestion" : "primary";
  const status = await writeIfDifferent(targetPath, content);

  return { targetPath, status, mode };
}

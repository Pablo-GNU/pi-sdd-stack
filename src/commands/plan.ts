import path from "node:path";
import { classifyFeatureImpact } from "../openspec/impactClassifier.js";
import { getChangePaths } from "../openspec/changePaths.js";
import { describeTddMode, readTddMode } from "../testing/tddMode.js";
import { ensureDir, readText, writeText } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";

async function loadTemplate(name: string): Promise<string> {
  const packageRoot = resolvePackageRoot(import.meta.url);
  const template = await readText(path.join(packageRoot, "assets", "openspec-schema", "pi-sdd-stack", "templates", `${name}.md`));
  if (!template) {
    throw new Error(`Missing OpenSpec template: ${name}.md`);
  }
  return template;
}

function render(name: string, template: string, slug: string, domain: string): string {
  const title = slug.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
  return template
    .replaceAll("{{title}}", title)
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{domain}}", domain)
    .replaceAll("{{requirementName}}", "TODO Requirement")
    .replaceAll("{{requirementDescription}}", "TODO describe the requirement.")
    .replaceAll("{{scenarioName}}", "TODO scenario")
    .replaceAll("{{given}}", "TODO")
    .replaceAll("{{when}}", "TODO")
    .replaceAll("{{then}}", "TODO")
    .replaceAll("{{existingRequirementName}}", "TODO Existing Requirement")
    .replaceAll("{{modifiedRequirementDescription}}", "TODO describe the modification.")
    .replaceAll("{{removedRequirementName}}", "TODO Removed Requirement")
    .replaceAll("{{removalReason}}", "TODO explain why it is removed.");
}

function summarizeDesignAndTasks(designContent: string, tasksContent: string): string {
  const designSections = designContent
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => `- ${line.replace(/^##\s+/, "")}`);

  const taskItems = tasksContent
    .split("\n")
    .filter((line) => line.trim().startsWith("- [ ]") || line.trim().startsWith("- [x]"))
    .slice(0, 8)
    .map((line) => line.trim());

  return [
    "review-before-apply:",
    "design sections:",
    ...(designSections.length > 0 ? designSections : ["- TODO review generated design"]),
    "tasks checklist:",
    ...(taskItems.length > 0 ? taskItems : ["- TODO review generated tasks"]),
    "next-step: review design and tasks together before starting apply.",
  ].join("\n");
}

export async function runPlan(cwd: string, slug: string): Promise<string> {
  const impact = await classifyFeatureImpact({ repoRoot: cwd, changeSlug: slug, summary: slug });
  const tddMode = await readTddMode(cwd);
  const paths = getChangePaths(cwd, slug);
  const proposalTemplate = await loadTemplate("proposal");
  const designTemplate = await loadTemplate("design");
  const tasksTemplate = await loadTemplate("tasks");
  const specTemplate = await loadTemplate("spec");

  const proposalContent = render("proposal", proposalTemplate, slug, impact.affectedDomains[0] ?? "domain");
  const designContent = render("design", designTemplate, slug, impact.affectedDomains[0] ?? "domain");
  const tasksContent = render("tasks", tasksTemplate, slug, impact.affectedDomains[0] ?? "domain");

  await writeText(paths.proposal, proposalContent);
  await writeText(paths.design, designContent);
  await writeText(paths.tasks, tasksContent);

  const domains = [...new Set([...impact.affectedDomains, ...impact.newDomainsNeeded])];
  for (const domain of domains.length > 0 ? domains : [slug.split("-")[0] ?? "domain"]) {
    const specPath = path.join(paths.specsDir, domain, "spec.md");
    await ensureDir(path.dirname(specPath));
    await writeText(specPath, render("spec", specTemplate, slug, domain));
  }

  return [
    `impact=${impact.kind}`,
    `tdd-mode=${tddMode}`,
    `artifacts=${[paths.proposal, paths.design, paths.tasks].map((entry) => path.relative(cwd, entry)).join(", ")}`,
    describeTddMode(tddMode),
    summarizeDesignAndTasks(designContent, tasksContent),
  ].join("\n");
}

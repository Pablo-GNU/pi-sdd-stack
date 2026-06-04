import path from "node:path";
import { classifyFeatureImpact } from "../openspec/impactClassifier.js";
import { getChangePaths } from "../openspec/changePaths.js";
import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";
import { buildPhaseReturnDigest } from "../sdd/phaseDigest.js";
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

export async function runPlan(cwd: string, slug: string, phase: PhaseName = PHASE_NAMES.SPEC): Promise<string> {
  const impact = await classifyFeatureImpact({ repoRoot: cwd, changeSlug: slug, summary: slug });
  const tddMode = await readTddMode(cwd);
  const paths = getChangePaths(cwd, slug);
  const proposalTemplate = await loadTemplate("proposal");
  const designTemplate = await loadTemplate("design");
  const tasksTemplate = await loadTemplate("tasks");
  const specTemplate = await loadTemplate("spec");
  const primaryDomain = impact.affectedDomains[0] ?? "domain";

  if (phase === PHASE_NAMES.SPEC) {
    const proposalContent = render("proposal", proposalTemplate, slug, primaryDomain);
    await writeText(paths.proposal, proposalContent);

    const domains = [...new Set([...impact.affectedDomains, ...impact.newDomainsNeeded])];
    for (const domain of domains.length > 0 ? domains : [slug.split("-")[0] ?? "domain"]) {
      const specPath = path.join(paths.specsDir, domain, "spec.md");
      await ensureDir(path.dirname(specPath));
      await writeText(specPath, render("spec", specTemplate, slug, domain));
    }
  }

  if (phase === PHASE_NAMES.DESIGN) {
    await writeText(paths.design, render("design", designTemplate, slug, primaryDomain));
  }

  if (phase === PHASE_NAMES.TASKS) {
    await writeText(paths.tasks, render("tasks", tasksTemplate, slug, primaryDomain));
  }

  const digest = await buildPhaseReturnDigest(cwd, slug, phase);
  return [
    `impact=${impact.kind}`,
    `tdd-mode=${tddMode}`,
    `phase=${phase}`,
    describeTddMode(tddMode),
    ...(digest ? ["", digest] : []),
  ].join("\n");
}

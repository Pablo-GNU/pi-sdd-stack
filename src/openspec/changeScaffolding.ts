import path from "node:path";
import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";
import { classifyFeatureImpact } from "./impactClassifier.js";
import { getChangePaths } from "./changePaths.js";
import { readText, writeTextIfMissing } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";
import { readRequestedDomainsForChange } from "./requestedDomains.js";

function renderTemplate(template: string, slug: string, domain: string): string {
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
    .replaceAll("{{removalReason}}", "TODO explain why it is removed.")
    .replaceAll("{{status}}", "TODO")
    .replaceAll("{{nextPhase}}", "TODO")
    .replaceAll("{{summary}}", "TODO summarize verification evidence.");
}

async function loadTemplate(name: "prd" | "proposal" | "design" | "tasks" | "verify" | "spec"): Promise<string> {
  const packageRoot = resolvePackageRoot(import.meta.url);
  const template = await readText(path.join(packageRoot, "assets", "openspec-schema", "pi-sdd-stack", "templates", `${name}.md`));
  if (!template) {
    throw new Error(`Missing OpenSpec template: ${name}.md`);
  }
  return template;
}

function fallbackDomain(slug: string): string {
  return slug.split("-")[0] ?? "domain";
}

async function ensurePrd(repoRoot: string, slug: string): Promise<string[]> {
  const paths = getChangePaths(repoRoot, slug);
  const created = await writeTextIfMissing(paths.prd, renderTemplate(await loadTemplate("prd"), slug, fallbackDomain(slug)));
  return created ? [path.relative(repoRoot, paths.prd)] : [];
}

async function ensureSpecPhaseArtifacts(repoRoot: string, slug: string): Promise<string[]> {
  const paths = getChangePaths(repoRoot, slug);
  const requestedDomains = await readRequestedDomainsForChange(repoRoot, slug);
  const impact = await classifyFeatureImpact({ repoRoot, changeSlug: slug, requestedDomains, summary: slug });
  const createdPaths: string[] = [];

  if (await writeTextIfMissing(paths.proposal, renderTemplate(await loadTemplate("proposal"), slug, fallbackDomain(slug)))) {
    createdPaths.push(path.relative(repoRoot, paths.proposal));
  }

  const domains = [...new Set([...impact.affectedDomains, ...impact.newDomainsNeeded])];
  for (const domain of domains.length > 0 ? domains : [fallbackDomain(slug)]) {
    const specPath = path.join(paths.specsDir, domain, "spec.md");
    if (await writeTextIfMissing(specPath, renderTemplate(await loadTemplate("spec"), slug, domain))) {
      createdPaths.push(path.relative(repoRoot, specPath));
    }
  }

  return createdPaths;
}

async function ensureDesign(repoRoot: string, slug: string): Promise<string[]> {
  const paths = getChangePaths(repoRoot, slug);
  const created = await writeTextIfMissing(paths.design, renderTemplate(await loadTemplate("design"), slug, fallbackDomain(slug)));
  return created ? [path.relative(repoRoot, paths.design)] : [];
}

async function ensureTasks(repoRoot: string, slug: string): Promise<string[]> {
  const paths = getChangePaths(repoRoot, slug);
  const created = await writeTextIfMissing(paths.tasks, renderTemplate(await loadTemplate("tasks"), slug, fallbackDomain(slug)));
  return created ? [path.relative(repoRoot, paths.tasks)] : [];
}

async function ensureVerify(repoRoot: string, slug: string): Promise<string[]> {
  const paths = getChangePaths(repoRoot, slug);
  const created = await writeTextIfMissing(paths.verify, renderTemplate(await loadTemplate("verify"), slug, fallbackDomain(slug)));
  return created ? [path.relative(repoRoot, paths.verify)] : [];
}

export async function prepareOpenSpecArtifacts(repoRoot: string, slug: string, phase: PhaseName): Promise<string[]> {
  if (phase === PHASE_NAMES.PRD) {
    return ensurePrd(repoRoot, slug);
  }

  if (phase === PHASE_NAMES.SPEC) {
    return [
      ...await ensurePrd(repoRoot, slug),
      ...await ensureSpecPhaseArtifacts(repoRoot, slug),
    ];
  }

  if (phase === PHASE_NAMES.DESIGN) {
    return [
      ...await ensurePrd(repoRoot, slug),
      ...await ensureSpecPhaseArtifacts(repoRoot, slug),
      ...await ensureDesign(repoRoot, slug),
    ];
  }

  if (phase === PHASE_NAMES.TASKS) {
    return [
      ...await ensurePrd(repoRoot, slug),
      ...await ensureSpecPhaseArtifacts(repoRoot, slug),
      ...await ensureDesign(repoRoot, slug),
      ...await ensureTasks(repoRoot, slug),
    ];
  }

  if (phase === PHASE_NAMES.VERIFY) {
    return [
      ...await ensurePrd(repoRoot, slug),
      ...await ensureSpecPhaseArtifacts(repoRoot, slug),
      ...await ensureDesign(repoRoot, slug),
      ...await ensureTasks(repoRoot, slug),
      ...await ensureVerify(repoRoot, slug),
    ];
  }

  return [];
}

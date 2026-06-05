import path from "node:path";
import { getChangePaths } from "../openspec/changePaths.js";
import { scanProject } from "../init/projectScanner.js";
import { ModelRouter, type PhaseRoute } from "../models/modelRouter.js";
import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";
import { resolveReferences } from "../context/referenceResolver.js";
import { SUBAGENTS } from "./subagentRegistry.js";
import { listDir, pathExists, readText } from "../util/fs.js";
import { writeIfDifferent } from "../init/safeWrite.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";
import { resolveProjectStatePaths } from "../sdd/projectState.js";

function quote(value: string): string {
  return JSON.stringify(value);
}

function buildInlineConfig(options: {
  skills?: string[];
  reads?: string[];
  model?: string;
  brevity?: string;
  progress?: boolean;
}): string {
  const parts: string[] = [];
  if (options.skills && options.skills.length > 0) {
    parts.push(`skills=${options.skills.join("+")}`);
  }
  if (options.reads && options.reads.length > 0) {
    parts.push(`reads=${options.reads.join("+")}`);
  }
  if (options.model) {
    parts.push(`model=${options.model}`);
  }
  if (options.brevity) {
    parts.push(`caveman-output=${options.brevity}`);
  }
  if (options.progress) {
    parts.push("progress");
  }
  return parts.length > 0 ? `[${parts.join(",")}]` : "";
}

function buildModelOverride(route?: PhaseRoute): string | undefined {
  if (!route || route.model === "inherit") {
    return undefined;
  }

  if (route.thinking && route.thinking !== "inherit") {
    return `${route.model}:${route.thinking}`;
  }

  return route.model;
}

function buildBrevityOverride(route?: PhaseRoute): string | undefined {
  if (!route || !route["caveman-output"]) {
    return undefined;
  }

  return route["caveman-output"];
}

async function collectSpecReads(specsDir: string, repoRoot: string): Promise<string[]> {
  if (!pathExists(specsDir)) {
    return [];
  }

  const domains = await listDir(specsDir);
  const reads: string[] = [];
  for (const domain of domains) {
    const specPath = path.join(specsDir, domain, "spec.md");
    if (pathExists(specPath)) {
      reads.push(path.relative(repoRoot, specPath));
    }
  }

  return reads.sort();
}

async function collectChangeReads(repoRoot: string, slug: string): Promise<string[]> {
  const paths = getChangePaths(repoRoot, slug);
  const reads = [
    paths.prd,
    paths.proposal,
    paths.design,
    paths.tasks,
    paths.verify,
  ].filter((entry) => pathExists(entry)).map((entry) => path.relative(repoRoot, entry));

  reads.push(...await collectSpecReads(paths.specsDir, repoRoot));
  return [...new Set(reads)];
}

function agentForPhase(phase: PhaseName, router: ModelRouter): { name: string; model?: string; brevity?: string } {
  const route = router.getPhaseRoute(phase);
  const model = buildModelOverride(route);
  const brevity = buildBrevityOverride(route);
  return {
    name: route?.agent ?? defaultAgentForPhase(phase),
    ...(model ? { model } : {}),
    ...(brevity ? { brevity } : {}),
  };
}

function defaultAgentForPhase(phase: PhaseName): string {
  switch (phase) {
    case PHASE_NAMES.GREENFIELD_ONBOARD:
    case PHASE_NAMES.PRD:
      return "pi-sdd-product";
    case PHASE_NAMES.SPEC:
      return "pi-sdd-spec";
    case PHASE_NAMES.DESIGN:
      return "pi-sdd-design";
    case PHASE_NAMES.TASKS:
      return "pi-sdd-tasker";
    case PHASE_NAMES.APPLY:
      return "pi-sdd-writer";
    case PHASE_NAMES.VERIFY:
      return "pi-sdd-verifier";
    case PHASE_NAMES.ARCHIVE:
      return "pi-sdd-archivist";
    case PHASE_NAMES.BUGFIX_MEMORY:
      return "pi-sdd-bugfix-memory";
    default:
      return "pi-sdd-scout";
  }
}

function brownfieldOnboardTask(slug: string, repoRoot: string): string {
  return [
    `Change slug: ${slug}.`,
    "Brownfield onboarding for existing repo.",
    `Create or improve ${path.relative(repoRoot, path.join(repoRoot, "AGENTS.md"))}.`,
    "Scan shallowly.",
    "Identify affected domains, repo layout, commands, testing, constraints.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function greenfieldOnboardTask(slug: string, repoRoot: string): string {
  return [
    `Change slug: ${slug}.`,
    "Greenfield onboarding for new project space.",
    `Create or improve ${path.relative(repoRoot, path.join(repoRoot, "AGENTS.md"))}.`,
    `Create or improve ${path.relative(repoRoot, path.join(repoRoot, "README.md"))} when needed.`,
    "Start from problem, users, value, repo shape.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function currentStateExploreContextTask(slug: string, repoRoot: string): string {
  const changeRoot = getChangePaths(repoRoot, slug).root;
  return [
    `Change slug: ${slug}.`,
    `Create or update ${path.relative(repoRoot, path.join(changeRoot, "current-state-context.md"))}.`,
    "Focus on repo surface, docs, AGENTS, README, OpenSpec coverage, module boundaries, likely impacted areas.",
    "Use shallow, targeted reads only.",
    "If residual unknowns remain, stop and list the narrow rerun needed instead of broadening the scan.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function currentStateExploreImpactTask(slug: string, repoRoot: string): string {
  const changeRoot = getChangePaths(repoRoot, slug).root;
  return [
    `Change slug: ${slug}.`,
    `Create or update ${path.relative(repoRoot, path.join(changeRoot, "current-state-impact.md"))}.`,
    "Focus on likely code paths, data flow, tests, constraints, edge cases, and implementation unknowns for this change.",
    "Use shallow, targeted reads only.",
    "If residual unknowns remain, stop and list the narrow rerun needed instead of broadening the scan.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function documentationReviewTask(slug: string, repoRoot: string): string {
  return [
    `Change slug: ${slug}.`,
    `Create or update ${path.relative(repoRoot, path.join(getChangePaths(repoRoot, slug).root, "documentation-review.md"))}.`,
    "Review AGENTS, README, docs, OpenSpec coverage.",
    "State already-covered areas, gaps, recommended next docs step.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function prdTask(slug: string, repoRoot: string): string {
  const paths = getChangePaths(repoRoot, slug);
  return [
    `Change slug: ${slug}.`,
    `Create or update ${path.relative(repoRoot, paths.prd)}.`,
    "Use product-first framing.",
    "Cover problem, goals, non-goals, users, journeys, acceptance criteria, risks, open questions.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function specTask(slug: string, repoRoot: string): string {
  const paths = getChangePaths(repoRoot, slug);
  return [
    `Change slug: ${slug}.`,
    `Read ${path.relative(repoRoot, paths.prd)}.`,
    `Create or update ${path.relative(repoRoot, paths.proposal)}.`,
    `Create or update delta specs under ${path.relative(repoRoot, paths.specsDir)}/**/spec.md.`,
    "Classify impact before writing.",
    "Read requestedDomains from prd.md frontmatter when present. Prioritize it over slug/summary heuristics for domain selection.",
    "Use ADDED, MODIFIED, REMOVED only inside active change.",
    "If the change extends an existing domain with net-new capability, reuse that domain and write ADDED. Use MODIFIED only when changing an existing requirement's semantics, constraints, or scenarios.",
    "Keep OpenSpec source-of-truth.",
  ].join("\n");
}

function designTask(slug: string, repoRoot: string): string {
  const paths = getChangePaths(repoRoot, slug);
  return [
    `Change slug: ${slug}.`,
    `Read ${path.relative(repoRoot, paths.prd)}, ${path.relative(repoRoot, paths.proposal)}, ${path.relative(repoRoot, paths.specsDir)}.`,
    `Create or update ${path.relative(repoRoot, paths.design)}.`,
    "Explain approach, tradeoffs, risks, verification hooks.",
    "Keep repo artifacts in English.",
  ].join("\n");
}

function tasksTask(slug: string, repoRoot: string): string {
  const paths = getChangePaths(repoRoot, slug);
  return [
    `Change slug: ${slug}.`,
    `Read ${path.relative(repoRoot, paths.prd)}, ${path.relative(repoRoot, paths.proposal)}, ${path.relative(repoRoot, paths.design)}, ${path.relative(repoRoot, paths.specsDir)}.`,
    `Create or update ${path.relative(repoRoot, paths.tasks)}.`,
    "Break work into evidence-checkable tasks.",
    "Do not claim completion.",
  ].join("\n");
}

function verifyTask(slug: string, repoRoot: string): string {
  const paths = getChangePaths(repoRoot, slug);
  return [
    `Change slug: ${slug}.`,
    `Create or update ${path.relative(repoRoot, paths.verify)}.`,
    "Map requirements + tasks to evidence.",
    "Cite tests, commands, manual checks.",
    "Note missing evidence clearly.",
    "Do not rewrite requirements during verification.",
  ].join("\n");
}

function archiveTask(slug: string): string {
  return [
    `Change slug: ${slug}.`,
    "Archive through OpenSpec CLI when available.",
    "If CLI missing, stop with actionable error.",
    "Do not improvise manual merge.",
  ].join("\n");
}

async function bugfixMemoryTask(slug: string, repoRoot: string): Promise<string> {
  const statePaths = await resolveProjectStatePaths(repoRoot);
  return [
    `Change slug: ${slug}.`,
    `Create or update ${path.join(statePaths.memoryDir, `${slug}.md`)}.`,
    "Save only operational memory: root cause, fix, evidence, conventions, setup notes, handoff.",
    "Never store OpenSpec artifacts in Engram.",
    "Stop if evidence missing.",
  ].join("\n");
}

export async function buildPhaseSubagentCommand(repoRoot: string, slug: string, phase: PhaseName, moduleUrl: string): Promise<string> {
  const router = await ModelRouter.create(moduleUrl, repoRoot);

  if (phase === PHASE_NAMES.BROWNFIELD_ONBOARD) {
    const agent = agentForPhase(PHASE_NAMES.BROWNFIELD_ONBOARD, router);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-brownfield-onboard"],
      progress: true,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(brownfieldOnboardTask(slug, repoRoot))} --bg`;
  }

  if (phase === PHASE_NAMES.GREENFIELD_ONBOARD) {
    const agent = agentForPhase(PHASE_NAMES.GREENFIELD_ONBOARD, router);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-greenfield-onboard"],
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(greenfieldOnboardTask(slug, repoRoot))}`;
  }

  if (phase === PHASE_NAMES.CURRENT_STATE_EXPLORE) {
    const reads = await collectChangeReads(repoRoot, slug);
    const agent = agentForPhase(PHASE_NAMES.CURRENT_STATE_EXPLORE, router);
    const inline = buildInlineConfig({
      reads,
      progress: true,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    });
    return [
      "/parallel",
      `${agent.name}${inline} ${quote(currentStateExploreContextTask(slug, repoRoot))}`,
      "->",
      `${agent.name}${inline} ${quote(currentStateExploreImpactTask(slug, repoRoot))}`,
      "--bg",
    ].join(" ");
  }

  if (phase === PHASE_NAMES.DOCUMENTATION_REVIEW) {
    const reads = await collectChangeReads(repoRoot, slug);
    const agent = agentForPhase(PHASE_NAMES.DOCUMENTATION_REVIEW, router);
    return `/run ${agent.name}${buildInlineConfig({
      reads,
      progress: true,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(documentationReviewTask(slug, repoRoot))} --bg`;
  }

  if (phase === PHASE_NAMES.PRD) {
    const agent = agentForPhase(PHASE_NAMES.PRD, router);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-feature-prd"],
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(prdTask(slug, repoRoot))}`;
  }

  if (phase === PHASE_NAMES.SPEC) {
    const reads = await collectChangeReads(repoRoot, slug);
    const agent = agentForPhase(PHASE_NAMES.SPEC, router);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-impact-classification", "sdd-stack-prd-to-sdd"],
      reads,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(specTask(slug, repoRoot))}`;
  }

  if (phase === PHASE_NAMES.DESIGN) {
    const reads = await collectChangeReads(repoRoot, slug);
    const agent = agentForPhase(PHASE_NAMES.DESIGN, router);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-prd-to-sdd"],
      reads,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(designTask(slug, repoRoot))}`;
  }

  if (phase === PHASE_NAMES.TASKS) {
    const reads = await collectChangeReads(repoRoot, slug);
    const agent = agentForPhase(PHASE_NAMES.TASKS, router);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-prd-to-sdd"],
      reads,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(tasksTask(slug, repoRoot))}`;
  }

  if (phase === PHASE_NAMES.APPLY) {
    const project = await scanProject(repoRoot);
    const references = await resolveReferences({ repoRoot: project.root, slug, phase: "apply", projectProfile: project });
    const changeReads = await collectChangeReads(project.root, slug);
    const reads = [...new Set([...changeReads, ...references.recommendedReads.map((entry) => entry.path)])];
    const agent = agentForPhase(PHASE_NAMES.APPLY, router);
    const task = [
      `Change slug: ${slug}.`,
      "Implementation mode: guided subagent.",
      "Read planned artifacts first.",
      "Implement only against referenced artifacts.",
      "Do not mark tasks complete without proof.",
      "Avoid bulk-loading repo context.",
      `Avoid bulk reads: ${references.avoidBulkReads.join(", ")}.`,
    ].join("\n");

    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-apply"],
      reads,
      progress: true,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(task)}`;
  }

  if (phase === PHASE_NAMES.VERIFY) {
    const agent = agentForPhase(PHASE_NAMES.VERIFY, router);
    const reads = await collectChangeReads(repoRoot, slug);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-verify"],
      reads,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(verifyTask(slug, repoRoot))}`;
  }

  if (phase === PHASE_NAMES.ARCHIVE) {
    const agent = agentForPhase(PHASE_NAMES.ARCHIVE, router);
    const reads = await collectChangeReads(repoRoot, slug);
    return `/run ${agent.name}${buildInlineConfig({
      reads,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(archiveTask(slug))}`;
  }

  if (phase === PHASE_NAMES.BUGFIX_MEMORY) {
    const agent = agentForPhase(PHASE_NAMES.BUGFIX_MEMORY, router);
    const reads = await collectChangeReads(repoRoot, slug);
    return `/run ${agent.name}${buildInlineConfig({
      skills: ["sdd-stack-bugfix-memory"],
      reads,
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.brevity ? { brevity: agent.brevity } : {}),
    })} ${quote(await bugfixMemoryTask(slug, repoRoot))}`;
  }

  throw new Error(`Phase ${phase} is not directly delegated by pi-sdd-stack.`);
}

export async function ensureManagedSubagents(repoRoot: string, moduleUrl: string): Promise<Array<{ name: string; status: "created" | "updated" | "unchanged" }>> {
  const packageRoot = resolvePackageRoot(moduleUrl);
  const targetDir = path.join(repoRoot, ".pi", "agents", "pi-sdd-stack");
  const results: Array<{ name: string; status: "created" | "updated" | "unchanged" }> = [];

  for (const agent of SUBAGENTS) {
    const sourcePath = path.join(packageRoot, agent.assetPath);
    const content = await readText(sourcePath);
    if (!content) {
      throw new Error(`Managed subagent asset missing: ${sourcePath}`);
    }

    const targetPath = path.join(targetDir, path.basename(agent.assetPath));
    const status = await writeIfDifferent(targetPath, content.endsWith("\n") ? content : `${content}\n`);
    results.push({ name: agent.name, status });
  }

  return results;
}

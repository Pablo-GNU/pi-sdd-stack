import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempDir, ensureFile } from "./helpers.js";
import { PHASE_NAMES } from "../src/models/phaseRoutes.js";
import { buildPhaseSubagentCommand, ensureManagedSubagents } from "../src/subagents/phaseDelegation.js";
import { readText } from "../src/util/fs.js";

describe("subagent phase delegation", () => {
  it("installs managed subagents under .pi/agents", async () => {
    const repoRoot = await createTempDir("managed-subagents");
    const results = await ensureManagedSubagents(repoRoot, import.meta.url);

    expect(results.length).toBeGreaterThan(0);
    const installed = await readText(path.join(repoRoot, ".pi", "agents", "pi-sdd-stack", "pi-sdd-product.md"));
    const bugfix = await readText(path.join(repoRoot, ".pi", "agents", "pi-sdd-stack", "pi-sdd-bugfix-memory.md"));
    expect(installed).toContain("name: pi-sdd-product");
    expect(installed).toContain("inheritProjectContext: true");
    expect(bugfix).toContain("name: pi-sdd-bugfix-memory");
    const spec = await readText(path.join(repoRoot, ".pi", "agents", "pi-sdd-stack", "pi-sdd-spec.md"));
    const scout = await readText(path.join(repoRoot, ".pi", "agents", "pi-sdd-stack", "pi-sdd-scout.md"));
    expect(spec).toContain("## OpenSpec Updates");
    expect(scout).toContain("maxExecutionTimeMs: 300000");
  });

  it("builds a delegated prd run command", async () => {
    const repoRoot = await createTempDir("delegated-prd");
    const command = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.PRD, import.meta.url);

    expect(command).toContain("/run pi-sdd-product");
    expect(command).toContain("skills=sdd-stack-feature-prd");
    expect(command).toContain("caveman-output=off");
    expect(command).not.toContain("--bg");
  });

  it("builds delegated onboarding + memory commands", async () => {
    const repoRoot = await createTempDir("delegated-extra");
    const brownfield = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.BROWNFIELD_ONBOARD, import.meta.url);
    const explore = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.CURRENT_STATE_EXPLORE, import.meta.url);
    const bugfix = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.BUGFIX_MEMORY, import.meta.url);

    expect(brownfield).toContain("/run pi-sdd-scout");
    expect(brownfield).toContain("sdd-stack-brownfield-onboard");
    expect(brownfield).toContain("caveman-output=micro");
    expect(explore).toContain("/parallel");
    expect(explore).toContain("current-state-context.md");
    expect(explore).toContain("current-state-impact.md");
    expect(explore).toContain("caveman-output=micro");
    expect(bugfix).toContain("/run pi-sdd-bugfix-memory");
    expect(bugfix).toContain("sdd-stack-bugfix-memory");
    expect(bugfix).toContain("caveman-output=micro");
  });

  it("builds delegated spec/design/tasks commands separately", async () => {
    const repoRoot = await createTempDir("delegated-plan");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "prd.md"), "# PRD\n");
    const spec = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.SPEC, import.meta.url);
    const design = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.DESIGN, import.meta.url);
    const tasks = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.TASKS, import.meta.url);

    expect(spec).toContain("/run pi-sdd-spec");
    expect(spec).toContain("sdd-stack-impact-classification+sdd-stack-prd-to-sdd");
    expect(spec).toContain("caveman-output=off");
    expect(design).toContain("/run pi-sdd-design");
    expect(design).toContain("sdd-stack-prd-to-sdd");
    expect(design).toContain("caveman-output=off");
    expect(tasks).toContain("/run pi-sdd-tasker");
    expect(tasks).toContain("sdd-stack-prd-to-sdd");
    expect(tasks).toContain("caveman-output=lite");
    expect(spec).not.toContain("/chain");
  });
});

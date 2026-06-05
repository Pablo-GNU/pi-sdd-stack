import path from "node:path";
import { describe, expect, it } from "vitest";
import { runPrd } from "../src/commands/prd.js";
import { runPlan } from "../src/commands/plan.js";
import { PHASE_NAMES } from "../src/models/phaseRoutes.js";
import { createTempDir, ensureFile } from "./helpers.js";
import { formatPhaseStatusesAsync } from "../src/sdd/orchestrator.js";

describe("requestedDomains discovery hints", () => {
  it("adds a requestedDomains hint to PRD output when unset", async () => {
    const repoRoot = await createTempDir("requested-domains-prd-hint");

    const result = await runPrd(repoRoot, "attach-avatar");

    expect(result).toContain("openspec/changes/attach-avatar/prd.md");
    expect(result).toContain("hint: if domain selection is ambiguous, set /sdd-stack:requested-domains attach-avatar domain1,domain2");
  });

  it("reports explicit requestedDomains during planning", async () => {
    const repoRoot = await createTempDir("requested-domains-plan-hint");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md"), "---\nrequestedDomains:\n  - client\n---\n\n# PRD: Attach Avatar\n");

    const result = await runPlan(repoRoot, "attach-avatar", PHASE_NAMES.SPEC);

    expect(result).toContain("requestedDomains=client");
    expect(result).not.toContain("hint=/sdd-stack:requested-domains attach-avatar domain1,domain2 if spec domain selection is ambiguous");
  });

  it("adds a requestedDomains hint to status output when unset", async () => {
    const repoRoot = await createTempDir("requested-domains-status-hint");

    const result = await formatPhaseStatusesAsync(repoRoot, "attach-avatar");

    expect(result).toContain("requestedDomains: (heuristic)");
    expect(result).toContain("hint: use /sdd-stack:requested-domains attach-avatar domain1,domain2 if the domain is ambiguous.");
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempDir, ensureFile } from "./helpers.js";
import { runContinue } from "../src/commands/continue.js";
import { runStatus } from "../src/commands/status.js";
import { runVerify } from "../src/commands/verify.js";

describe("phase orchestration", () => {
  it("reports next ready phase for an empty change as prd", async () => {
    const repoRoot = await createTempDir("phase-status");
    const status = await runStatus(repoRoot, "add-dark-mode");
    expect(status).toContain("next: prd");
  });

  it("routes continue to plan after prd exists", async () => {
    const repoRoot = await createTempDir("phase-continue-plan");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "prd.md"), "# PRD\n");
    const result = await runContinue(repoRoot, "add-dark-mode");
    expect(result).toContain("phase=spec");
    expect(result).toContain("review-before-apply:");
    expect(result).toContain("design sections:");
    expect(result).toContain("tasks checklist:");
  });

  it("routes back to apply when verify fails", async () => {
    const repoRoot = await createTempDir("phase-verify-fail");
    await ensureFile(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "tasks.md"), "# Tasks\n\n- [ ] Incomplete\n");
    const verifyResult = await runVerify(repoRoot, "add-dark-mode");
    expect(verifyResult).toContain("status=fail");

    const result = await runContinue(repoRoot, "add-dark-mode");
    expect(result).toContain("phase=apply");
  });
});

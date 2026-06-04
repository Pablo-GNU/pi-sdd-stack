import { describe, expect, it } from "vitest";
import { loadDefaultMemoryPolicy, validateMemoryWrite } from "../src/memory/memoryPolicy.js";

describe("memory policy", () => {
  it("allows bug_fix with evidence", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, {
      category: "bug_fix",
      title: "Invite expiry compared with local time",
      summary: "Expired invite tokens were accepted because expiry comparison used server local time.",
      rootCause: "Expiry checks used local time instead of UTC.",
      fix: "Normalize expiry comparison to UTC.",
      evidence: ["tests/invitations/acceptance.test.ts"],
      capturePrompt: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.normalized.capturePrompt).toBe(false);
  });

  it("allows project_convention", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, {
      category: "project_convention",
      title: "Use UTC for expiry",
      summary: "Date comparisons use UTC across invite logic.",
      capturePrompt: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.normalized.capturePrompt).toBe(false);
  });

  it("allows architecture decisions as compact operational memory", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, {
      category: "architecture_decision",
      title: "Use UTC for invite expiry comparisons",
      summary: "All invite expiry checks use UTC to avoid timezone drift across services.",
      references: ["src/invitations/accept.ts"],
      capturePrompt: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.normalized.capturePrompt).toBe(false);
  });

  it("blocks prd", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, { category: "prd", title: "PRD", summary: "Full PRD" });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain("belong in OpenSpec");
  });

  it("blocks spec", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, { category: "spec", title: "Spec", summary: "Spec body" });
    expect(result.allowed).toBe(false);
  });

  it("blocks tasks", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, { category: "tasks", title: "Tasks", summary: "Task list" });
    expect(result.allowed).toBe(false);
  });

  it("blocks documentation-style memory even in otherwise allowed categories", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, {
      category: "project_convention",
      title: "Added root README documentation",
      summary: "Project documentation and onboarding overview for the monorepo.",
      capturePrompt: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("project documentation");
  });

  it("forces capturePrompt false for automated writes", async () => {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const result = validateMemoryWrite(policy, {
      category: "session_handoff",
      title: "handoff",
      summary: "Short handoff",
      capturePrompt: true,
    });

    expect(result.normalized.capturePrompt).toBe(false);
  });
});

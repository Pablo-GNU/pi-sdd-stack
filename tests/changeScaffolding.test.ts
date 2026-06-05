import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempDir, ensureFile } from "./helpers.js";
import { prepareOpenSpecArtifacts } from "../src/openspec/changeScaffolding.js";
import { PHASE_NAMES } from "../src/models/phaseRoutes.js";
import { readText } from "../src/util/fs.js";
import { buildPhaseSubagentCommand } from "../src/subagents/phaseDelegation.js";

describe("OpenSpec change scaffolding", () => {
  it("prepares missing spec artifacts from an existing PRD without overwriting the PRD", async () => {
    const repoRoot = await createTempDir("openspec-scaffold-spec");
    const prdPath = path.join(repoRoot, "openspec", "changes", "add-dark-mode", "prd.md");
    await ensureFile(prdPath, "# Existing PRD\n\nKeep me.\n");

    const created = await prepareOpenSpecArtifacts(repoRoot, "add-dark-mode", PHASE_NAMES.SPEC);

    expect(created).toContain("openspec/changes/add-dark-mode/proposal.md");
    expect(created).toContain("openspec/changes/add-dark-mode/specs/add/spec.md");
    expect(await readText(prdPath)).toBe("# Existing PRD\n\nKeep me.\n");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "proposal.md"))).toContain("# Proposal: Add Dark Mode");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "specs", "add", "spec.md"))).toContain("# add Specification Delta");
  });

  it("prepares transitive planning artifacts for tasks phase", async () => {
    const repoRoot = await createTempDir("openspec-scaffold-tasks");

    await prepareOpenSpecArtifacts(repoRoot, "add-dark-mode", PHASE_NAMES.TASKS);

    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "prd.md"))).toContain("# PRD");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "proposal.md"))).toContain("# Proposal: Add Dark Mode");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "design.md"))).toContain("# Design: Add Dark Mode");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-dark-mode", "tasks.md"))).toContain("# Tasks: Add Dark Mode");
  });

  it("reuses existing canonical domain for follow-up change scaffolding", async () => {
    const repoRoot = await createTempDir("openspec-scaffold-follow-up");
    await ensureFile(path.join(repoRoot, "openspec/specs/client/spec.md"), "# client\n\n### Requirement: Client Creation\nClients can be created.\n");

    const created = await prepareOpenSpecArtifacts(repoRoot, "add-client-profile-photo", PHASE_NAMES.SPEC);

    expect(created).toContain("openspec/changes/add-client-profile-photo/proposal.md");
    expect(created).toContain("openspec/changes/add-client-profile-photo/specs/client/spec.md");
    expect(created).not.toContain("openspec/changes/add-client-profile-photo/specs/add/spec.md");
    expect(await readText(path.join(repoRoot, "openspec", "changes", "add-client-profile-photo", "specs", "client", "spec.md"))).toContain("# client Specification Delta");
  });

  it("feeds scaffolded proposal and delta specs into delegated spec reads", async () => {
    const repoRoot = await createTempDir("openspec-scaffold-command");
    await prepareOpenSpecArtifacts(repoRoot, "add-dark-mode", PHASE_NAMES.SPEC);

    const command = await buildPhaseSubagentCommand(repoRoot, "add-dark-mode", PHASE_NAMES.SPEC, import.meta.url);

    expect(command).toContain("openspec/changes/add-dark-mode/prd.md");
    expect(command).toContain("openspec/changes/add-dark-mode/proposal.md");
    expect(command).toContain("openspec/changes/add-dark-mode/specs/add/spec.md");
  });

  it("feeds reused existing-domain delta specs into delegated spec reads", async () => {
    const repoRoot = await createTempDir("openspec-scaffold-follow-up-command");
    await ensureFile(path.join(repoRoot, "openspec/specs/client/spec.md"), "# client\n\n### Requirement: Client Creation\nClients can be created.\n");
    await prepareOpenSpecArtifacts(repoRoot, "add-client-profile-photo", PHASE_NAMES.SPEC);

    const command = await buildPhaseSubagentCommand(repoRoot, "add-client-profile-photo", PHASE_NAMES.SPEC, import.meta.url);

    expect(command).toContain("openspec/changes/add-client-profile-photo/prd.md");
    expect(command).toContain("openspec/changes/add-client-profile-photo/proposal.md");
    expect(command).toContain("openspec/changes/add-client-profile-photo/specs/client/spec.md");
    expect(command).not.toContain("openspec/changes/add-client-profile-photo/specs/add/spec.md");
  });

  it("prioritizes requestedDomains from prd frontmatter for ambiguous slugs", async () => {
    const repoRoot = await createTempDir("openspec-scaffold-requested-domains");
    await ensureFile(path.join(repoRoot, "openspec/specs/client/spec.md"), "# client\n\n### Requirement: Client Creation\nClients can be created.\n");
    await ensureFile(path.join(repoRoot, "openspec/changes/attach-avatar/prd.md"), "---\nrequestedDomains:\n  - client\n---\n\n# PRD: Attach Avatar\n");

    const created = await prepareOpenSpecArtifacts(repoRoot, "attach-avatar", PHASE_NAMES.SPEC);
    const command = await buildPhaseSubagentCommand(repoRoot, "attach-avatar", PHASE_NAMES.SPEC, import.meta.url);

    expect(created).toContain("openspec/changes/attach-avatar/proposal.md");
    expect(created).toContain("openspec/changes/attach-avatar/specs/client/spec.md");
    expect(created).not.toContain("openspec/changes/attach-avatar/specs/attach/spec.md");
    expect(command).toContain("openspec/changes/attach-avatar/specs/client/spec.md");
    expect(command).not.toContain("openspec/changes/attach-avatar/specs/attach/spec.md");
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyFeatureImpact, FEATURE_IMPACT_KIND } from "../src/openspec/impactClassifier.js";
import { createTempDir, ensureFile } from "./helpers.js";

describe("classifyFeatureImpact", () => {
  it("classifies a new domain", async () => {
    const repoRoot = await createTempDir("impact-new-domain");
    const result = await classifyFeatureImpact({ repoRoot, changeSlug: "add-billing", requestedDomains: ["billing"] });

    expect(result.kind).toBe(FEATURE_IMPACT_KIND.NEW_DOMAIN);
    expect(result.newDomainsNeeded).toContain("billing");
    expect(result.docActions).toContain("create_new_domain_delta_spec");
  });

  it("classifies new requirement in existing domain", async () => {
    const repoRoot = await createTempDir("impact-existing-domain");
    await ensureFile(path.join(repoRoot, "openspec/specs/teams/spec.md"), "# teams\n\n### Requirement: Team Membership\n");

    const result = await classifyFeatureImpact({ repoRoot, changeSlug: "teams-invite", requestedDomains: ["teams"], summary: "add invite flow to teams" });

    expect(result.kind).toBe(FEATURE_IMPACT_KIND.NEW_REQUIREMENT_EXISTING_DOMAIN);
    expect(result.affectedDomains).toContain("teams");
  });

  it("classifies existing requirement modification", async () => {
    const repoRoot = await createTempDir("impact-modify");
    await ensureFile(path.join(repoRoot, "openspec/specs/auth/spec.md"), "# auth\n\n### Requirement: auth login\n");

    const result = await classifyFeatureImpact({ repoRoot, changeSlug: "auth-session", requestedDomains: ["auth"], summary: "modify auth login session behavior" });

    expect(result.kind).toBe(FEATURE_IMPACT_KIND.MODIFIES_EXISTING_BEHAVIOR);
    expect(result.docActions).toContain("update_delta_spec");
  });

  it("classifies cross-domain changes", async () => {
    const repoRoot = await createTempDir("impact-cross");
    await ensureFile(path.join(repoRoot, "openspec/specs/teams/spec.md"), "# teams\n");
    await ensureFile(path.join(repoRoot, "openspec/specs/auth/spec.md"), "# auth\n");

    const result = await classifyFeatureImpact({
      repoRoot,
      changeSlug: "add-team-invitations",
      requestedDomains: ["teams", "auth", "email"],
      summary: "add invite flow affecting teams auth email",
    });

    expect(result.kind).toBe(FEATURE_IMPACT_KIND.CROSS_CUTTING_EXISTING_BEHAVIOR);
    expect(result.docActions).toContain("do_not_edit_source_specs_until_archive");
  });

  it("always recommends no direct edit to source specs during active feature", async () => {
    const repoRoot = await createTempDir("impact-no-direct-edit");
    const result = await classifyFeatureImpact({ repoRoot, changeSlug: "something", requestedDomains: ["new-domain"] });

    expect(result.docActions).toContain("do_not_edit_source_specs_until_archive");
  });
});

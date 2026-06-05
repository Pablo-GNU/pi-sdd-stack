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

  it("reuses existing domain for follow-up entity extensions", async () => {
    const repoRoot = await createTempDir("impact-follow-up-domain");
    await ensureFile(path.join(repoRoot, "openspec/specs/client/spec.md"), "# client\n\n### Requirement: Client Creation\nClients can be created.\n");

    const result = await classifyFeatureImpact({ repoRoot, changeSlug: "add-client-profile-photo", summary: "add client profile photo" });

    expect(result.kind).toBe(FEATURE_IMPACT_KIND.NEW_REQUIREMENT_EXISTING_DOMAIN);
    expect(result.affectedDomains).toEqual(["client"]);
    expect(result.newDomainsNeeded).toEqual([]);
    expect(result.notes).toContain("Follow-up change extends an existing domain. Reuse the existing domain delta spec path inside the active change.");
    expect(result.notes).toContain("Use ADDED when the capability is net-new inside an existing domain. Use MODIFIED only when changing an existing requirement's semantics, constraints, or scenarios.");
  });

  it("prioritizes requestedDomains from prd frontmatter over ambiguous slug heuristics", async () => {
    const repoRoot = await createTempDir("impact-requested-domains-frontmatter");
    await ensureFile(path.join(repoRoot, "openspec/specs/client/spec.md"), "# client\n\n### Requirement: Client Creation\nClients can be created.\n");
    await ensureFile(path.join(repoRoot, "openspec/changes/attach-avatar/prd.md"), "---\nrequestedDomains:\n  - client\n---\n\n# PRD: Attach Avatar\n");

    const result = await classifyFeatureImpact({ repoRoot, changeSlug: "attach-avatar", summary: "attach avatar to a record" });

    expect(result.kind).toBe(FEATURE_IMPACT_KIND.NEW_REQUIREMENT_EXISTING_DOMAIN);
    expect(result.affectedDomains).toEqual(["client"]);
    expect(result.newDomainsNeeded).toEqual([]);
    expect(result.notes).toContain("requestedDomains=client from prd.md takes priority over slug/summary heuristics.");
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

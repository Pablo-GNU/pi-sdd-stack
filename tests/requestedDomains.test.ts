import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempDir, ensureFile } from "./helpers.js";
import { parseRequestedDomainsFromPrd, readRequestedDomainsForChange, writeRequestedDomainsForChange } from "../src/openspec/requestedDomains.js";
import { readText } from "../src/util/fs.js";

describe("requestedDomains frontmatter helper", () => {
  it("parses requestedDomains from valid frontmatter", () => {
    const content = "---\nrequestedDomains:\n  - Client\n  - auth\n---\n\n# PRD\n";

    expect(parseRequestedDomainsFromPrd(content)).toEqual(["client", "auth"]);
  });

  it("preserves existing frontmatter keys while updating requestedDomains", async () => {
    const repoRoot = await createTempDir("requested-domains-frontmatter");
    const prdPath = path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md");
    await ensureFile(prdPath, "---\nowner: product\nrequestedDomains:\n  - old-domain\n---\n\n# PRD: Attach Avatar\n");

    const result = await writeRequestedDomainsForChange(repoRoot, "attach-avatar", ["client", "auth"]);
    const nextContent = await readText(prdPath);

    expect(result).toEqual({ domains: ["client", "auth"], updated: true });
    expect(nextContent).toContain("owner: product");
    expect(nextContent).toContain("requestedDomains:");
    expect(nextContent).toContain("- client");
    expect(nextContent).toContain("- auth");
    expect(await readRequestedDomainsForChange(repoRoot, "attach-avatar")).toEqual(["client", "auth"]);
  });

  it("creates frontmatter when prd exists without frontmatter", async () => {
    const repoRoot = await createTempDir("requested-domains-no-frontmatter");
    const prdPath = path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md");
    await ensureFile(prdPath, "# PRD: Attach Avatar\n\nBody\n");

    await writeRequestedDomainsForChange(repoRoot, "attach-avatar", "client");

    const nextContent = await readText(prdPath);
    expect(nextContent?.startsWith("---\nrequestedDomains:\n  - client\n---\n\n# PRD: Attach Avatar")).toBe(true);
  });

  it("creates a minimal prd when the file does not exist", async () => {
    const repoRoot = await createTempDir("requested-domains-create-prd");

    const result = await writeRequestedDomainsForChange(repoRoot, "attach-avatar", "client auth");
    const prdPath = path.join(repoRoot, "openspec", "changes", "attach-avatar", "prd.md");
    const nextContent = await readText(prdPath);

    expect(result).toEqual({ domains: ["client", "auth"], updated: true });
    expect(nextContent).toContain("requestedDomains:");
    expect(nextContent).toContain("# PRD: Attach Avatar");
  });
});

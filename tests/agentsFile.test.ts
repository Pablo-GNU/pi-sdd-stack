import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { generateAgentsFile } from "../src/init/agentsFile.js";
import { PROJECT_TYPES, CONFIDENCE, type ProjectScanResult } from "../src/init/projectProfile.js";
import { createTempDir, ensureFile } from "./helpers.js";

function buildScan(overrides: Partial<ProjectScanResult> = {}): ProjectScanResult {
  return {
    root: "/repo",
    projectName: "demo-app",
    projectType: PROJECT_TYPES.SINGLE_APP,
    packageManager: "pnpm",
    languages: ["TypeScript"],
    frameworks: ["React"],
    runtimes: ["Node.js"],
    services: [],
    commands: [{ command: "pnpm test", purpose: "Run automated tests" }],
    notablePaths: [{ path: "src", purpose: "Application source" }],
    envExamples: [".env.example"],
    testing: ["Vitest"],
    buildDeploy: ["Docker"],
    confidence: CONFIDENCE.HIGH,
    ...overrides,
  };
}

const templatePath = "/home/pablognu/dev/pi-sdd-stack/assets/project/AGENTS.template.md";

describe("generateAgentsFile", () => {
  it("creates AGENTS.md if missing", async () => {
    const repoRoot = await createTempDir("agents-missing");
    const result = await generateAgentsFile({
      repoRoot,
      scan: buildScan({ root: repoRoot, notablePaths: [{ path: "openspec", purpose: "Specifications" }] }),
      templatePath,
    });
    const content = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(result.mode).toBe("primary");
    expect(content).toContain("Project: `demo-app`");
    expect(content).toContain("openspec/specs/");
    expect(content).toContain("## Documentation map");
    expect(content).not.toContain("## Testing expectations");
  });

  it("does not include pi-sdd-stack workflow rules or context-map references", async () => {
    const repoRoot = await createTempDir("agents-content");
    await generateAgentsFile({ repoRoot, scan: buildScan({ root: repoRoot }), templatePath });
    const content = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(content).not.toContain("pi-sdd-stack");
    expect(content).not.toContain("context-map.yaml");
    expect(content).not.toContain("/sdd-stack:");
    expect(content).not.toContain("Siguiente mejora sugerida");
  });

  it("does not overwrite existing AGENTS.md", async () => {
    const repoRoot = await createTempDir("agents-existing");
    await ensureFile(path.join(repoRoot, "AGENTS.md"), "# Existing\n");

    await generateAgentsFile({ repoRoot, scan: buildScan({ root: repoRoot }), templatePath });

    const primary = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");
    const suggestion = await readFile(path.join(repoRoot, ".pi", "sdd-stack", "AGENTS.suggested.md"), "utf8");

    expect(primary).toBe("# Existing\n");
    expect(suggestion).toContain("## Summary");
  });

  it("creates suggestion file when AGENTS already exists", async () => {
    const repoRoot = await createTempDir("agents-suggestion");
    await ensureFile(path.join(repoRoot, "AGENTS.md"), "# Existing\n");

    const result = await generateAgentsFile({ repoRoot, scan: buildScan({ root: repoRoot }), templatePath });
    expect(result.mode).toBe("suggestion");
    expect(result.targetPath).toContain("AGENTS.suggested.md");
  });

  it("handles monorepo service rows", async () => {
    const repoRoot = await createTempDir("agents-monorepo");
    await generateAgentsFile({
      repoRoot,
      scan: buildScan({
        root: repoRoot,
        projectType: PROJECT_TYPES.MONOREPO,
        services: [{ name: "web", path: "apps/web", runtime: "node", purpose: "Frontend" }],
      }),
      templatePath,
    });

    const content = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");
    expect(content).toContain("| web | apps/web | node | Frontend |");
  });

  it("includes operational rules instead of session-style notes", async () => {
    const repoRoot = await createTempDir("agents-operational-rules");
    await generateAgentsFile({ repoRoot, scan: buildScan({ root: repoRoot }), templatePath });
    const content = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(content).toContain("## Operational rules");
    expect(content).not.toContain("## Development notes");
  });

  it("includes a documentation map that avoids duplicating openspec", async () => {
    const repoRoot = await createTempDir("agents-doc-map");
    await generateAgentsFile({
      repoRoot,
      scan: buildScan({ root: repoRoot, notablePaths: [{ path: "openspec", purpose: "Specifications" }] }),
      templatePath,
    });
    const content = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(content).toContain("- Product/spec behavior: `openspec/specs/`");
    expect(content).toContain("- Active/planned changes: `openspec/changes/`");
  });
});

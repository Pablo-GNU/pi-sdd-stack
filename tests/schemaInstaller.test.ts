import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { installOpenSpecSchema } from "../src/openspec/schemaInstaller.js";
import { createTempDir, ensureFile } from "./helpers.js";

describe("installOpenSpecSchema", () => {
  it("installs schema into openspec/schemas/pi-sdd-stack", async () => {
    const repoRoot = await createTempDir("schema-install");
    const result = await installOpenSpecSchema(import.meta.url, { repoRoot });

    expect(result.schemaPath).toBe(path.join(repoRoot, "openspec", "schemas", "pi-sdd-stack"));
    const schema = await readFile(path.join(repoRoot, "openspec", "schemas", "pi-sdd-stack", "schema.yaml"), "utf8");
    expect(schema).toContain("name: pi-sdd-stack");
  });

  it("does not overwrite modified schema unless force is passed", async () => {
    const repoRoot = await createTempDir("schema-protect");
    const schemaPath = path.join(repoRoot, "openspec", "schemas", "pi-sdd-stack", "schema.yaml");
    await ensureFile(schemaPath, "custom: true\n");

    await installOpenSpecSchema(import.meta.url, { repoRoot });
    const preserved = await readFile(schemaPath, "utf8");
    expect(preserved).toBe("custom: true\n");

    await installOpenSpecSchema(import.meta.url, { repoRoot, force: true });
    const replaced = await readFile(schemaPath, "utf8");
    expect(replaced).toContain("name: pi-sdd-stack");
  });

  it("creates config if missing", async () => {
    const repoRoot = await createTempDir("schema-config");
    await installOpenSpecSchema(import.meta.url, { repoRoot });

    const config = await readFile(path.join(repoRoot, "openspec", "config.yaml"), "utf8");
    expect(config).toContain("defaultSchema: pi-sdd-stack");
  });

  it("does not create an openspec README index by default", async () => {
    const repoRoot = await createTempDir("schema-no-index");
    await installOpenSpecSchema(import.meta.url, { repoRoot });

    await expect(readFile(path.join(repoRoot, "openspec", "README.md"), "utf8")).rejects.toThrow();
  });

  it("keeps model routes local file creation out of schema installer", async () => {
    const repoRoot = await createTempDir("schema-no-models-local");
    await installOpenSpecSchema(import.meta.url, { repoRoot });

    await expect(readFile(path.join(repoRoot, ".pi", "sdd-stack", "models.local.json"), "utf8")).rejects.toThrow();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { createTempDir } from "./helpers.js";
import { readTddMode, writeTddMode } from "../src/testing/tddMode.js";

describe("tdd mode", () => {
  afterEach(() => {
    delete process.env.PI_SDD_STACK_USER_HOME;
  });

  it("defaults to standard when settings do not exist", async () => {
    const repoRoot = await createTempDir("tdd-default");
    process.env.PI_SDD_STACK_USER_HOME = repoRoot;
    expect(await readTddMode(repoRoot)).toBe("standard");
  });

  it("persists strict mode to user settings", async () => {
    const repoRoot = await createTempDir("tdd-strict");
    process.env.PI_SDD_STACK_USER_HOME = repoRoot;
    await writeTddMode(repoRoot, "strict");
    expect(await readTddMode(repoRoot)).toBe("strict");
  });
});

import { describe, expect, it } from "vitest";
import { PHASE_NAMES } from "../src/models/phaseRoutes.js";
import { getPhaseNode } from "../src/sdd/phaseGraph.js";

describe("phase graph", () => {
  it("connects current-state exploration to prd and design", () => {
    const node = getPhaseNode(PHASE_NAMES.CURRENT_STATE_EXPLORE);
    expect(node.feeds).toContain(PHASE_NAMES.PRD);
    expect(node.feeds).toContain(PHASE_NAMES.DESIGN);
  });

  it("makes design depend on spec and current-state exploration", () => {
    const node = getPhaseNode(PHASE_NAMES.DESIGN);
    expect(node.dependsOn).toContain(PHASE_NAMES.SPEC);
    expect(node.dependsOn).toContain(PHASE_NAMES.CURRENT_STATE_EXPLORE);
  });

  it("keeps onboarding outside the main sdd dependency chain", () => {
    const node = getPhaseNode(PHASE_NAMES.BROWNFIELD_ONBOARD);
    expect(node.dependsOn).toEqual([]);
    expect(node.feeds).toEqual([]);
  });
});

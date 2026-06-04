export interface GuidedSubagentPlan {
  phase: string;
  summary: string;
  references: string[];
  cautions: string[];
}

export function createGuidedPlan(phase: string, references: string[]): GuidedSubagentPlan {
  return {
    phase,
    summary: `Guided ${phase} mode for pi-sdd-stack v0.1`,
    references,
    cautions: [
      "Read only the referenced files.",
      "Do not bulk-load the repo into context.",
      "Do not treat Engram as a spec store.",
    ],
  };
}

export interface SubagentDefinition {
  name: string;
  assetPath: string;
  modelProfile: string;
}

export const SUBAGENTS: SubagentDefinition[] = [
  { name: "pi-sdd-scout", assetPath: "assets/agents/pi-sdd-scout.md", modelProfile: "cheap" },
  { name: "pi-sdd-product", assetPath: "assets/agents/pi-sdd-product.md", modelProfile: "reasoning" },
  { name: "pi-sdd-spec", assetPath: "assets/agents/pi-sdd-spec.md", modelProfile: "reasoning" },
  { name: "pi-sdd-design", assetPath: "assets/agents/pi-sdd-design.md", modelProfile: "reasoning" },
  { name: "pi-sdd-tasker", assetPath: "assets/agents/pi-sdd-tasker.md", modelProfile: "reasoning" },
  { name: "pi-sdd-writer", assetPath: "assets/agents/pi-sdd-writer.md", modelProfile: "coding" },
  { name: "pi-sdd-verifier", assetPath: "assets/agents/pi-sdd-verifier.md", modelProfile: "review" },
  { name: "pi-sdd-archivist", assetPath: "assets/agents/pi-sdd-archivist.md", modelProfile: "cheap" },
  { name: "pi-sdd-bugfix-memory", assetPath: "assets/agents/pi-sdd-bugfix-memory.md", modelProfile: "cheap" },
];

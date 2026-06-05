export interface SubagentDefinition {
  name: string;
  assetPath: string;
}

export const SUBAGENTS: SubagentDefinition[] = [
  { name: "pi-sdd-scout", assetPath: "assets/agents/pi-sdd-scout.md" },
  { name: "pi-sdd-product", assetPath: "assets/agents/pi-sdd-product.md" },
  { name: "pi-sdd-spec", assetPath: "assets/agents/pi-sdd-spec.md" },
  { name: "pi-sdd-design", assetPath: "assets/agents/pi-sdd-design.md" },
  { name: "pi-sdd-tasker", assetPath: "assets/agents/pi-sdd-tasker.md" },
  { name: "pi-sdd-writer", assetPath: "assets/agents/pi-sdd-writer.md" },
  { name: "pi-sdd-verifier", assetPath: "assets/agents/pi-sdd-verifier.md" },
  { name: "pi-sdd-archivist", assetPath: "assets/agents/pi-sdd-archivist.md" },
  { name: "pi-sdd-bugfix-memory", assetPath: "assets/agents/pi-sdd-bugfix-memory.md" },
];

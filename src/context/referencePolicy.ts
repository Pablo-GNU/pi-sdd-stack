export interface ReferencePolicy {
  avoidBulkReads: string[];
  preferProjectFacts: boolean;
}

export const DEFAULT_REFERENCE_POLICY: ReferencePolicy = {
  avoidBulkReads: ["openspec/specs/**/*.md", "openspec/changes/**/*.md", "src/**/*"],
  preferProjectFacts: true,
};

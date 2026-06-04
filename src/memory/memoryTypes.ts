export interface MemoryWriteRequest {
  category: string;
  title: string;
  summary: string;
  rootCause?: string;
  fix?: string;
  evidence?: string[];
  references?: string[];
  capturePrompt?: boolean;
}

export interface MemoryPolicyConfig {
  version: number;
  mode: string;
  allowedWriteCategories: string[];
  forbiddenWriteCategories: string[];
  rules: string[];
}

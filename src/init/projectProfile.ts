export interface ProjectService {
  name: string;
  path: string;
  runtime?: string;
  purpose?: string;
}

export interface ProjectCommand {
  command: string;
  purpose: string;
}

export interface ProjectPathNote {
  path: string;
  purpose: string;
}

export const PROJECT_TYPES = {
  SINGLE_APP: "single-app",
  MONOREPO: "monorepo",
  LIBRARY: "library",
  SERVICE_COLLECTION: "service-collection",
  UNKNOWN: "unknown",
} as const;

export type ProjectType = (typeof PROJECT_TYPES)[keyof typeof PROJECT_TYPES];

export const CONFIDENCE = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type Confidence = (typeof CONFIDENCE)[keyof typeof CONFIDENCE];

export interface ProjectScanResult {
  root: string;
  projectName: string;
  projectType: ProjectType;
  packageManager?: "pnpm" | "npm" | "yarn" | "bun";
  languages: string[];
  frameworks: string[];
  runtimes: string[];
  services: ProjectService[];
  commands: ProjectCommand[];
  notablePaths: ProjectPathNote[];
  envExamples: string[];
  testing: string[];
  buildDeploy: string[];
  confidence: Confidence;
}

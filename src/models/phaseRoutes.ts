export const PHASE_NAMES = {
  BROWNFIELD_ONBOARD: "brownfield.onboard",
  GREENFIELD_ONBOARD: "greenfield.onboard",
  CURRENT_STATE_EXPLORE: "current-state.explore",
  DOCUMENTATION_REVIEW: "documentation.review",
  PRD: "prd",
  SPEC: "spec",
  DESIGN: "design",
  TASKS: "tasks",
  APPLY: "apply",
  VERIFY: "verify",
  ARCHIVE: "archive",
  BUGFIX_MEMORY: "bugfix.memory",
} as const;

export type PhaseName = (typeof PHASE_NAMES)[keyof typeof PHASE_NAMES];

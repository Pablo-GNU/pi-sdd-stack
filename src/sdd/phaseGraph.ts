import { PHASE_NAMES, type PhaseName } from "../models/phaseRoutes.js";

export interface PhaseNode {
  phase: PhaseName;
  category: "onboarding" | "exploration" | "sdd" | "memory";
  dependsOn: PhaseName[];
  softDependsOn?: PhaseName[];
  feeds: PhaseName[];
  purpose: string;
}

export const PHASE_GRAPH: Record<PhaseName, PhaseNode> = {
  [PHASE_NAMES.BROWNFIELD_ONBOARD]: {
    phase: PHASE_NAMES.BROWNFIELD_ONBOARD,
    category: "onboarding",
    dependsOn: [],
    feeds: [],
    purpose: "Create or improve operational and documentation entry points for an existing repository.",
  },
  [PHASE_NAMES.GREENFIELD_ONBOARD]: {
    phase: PHASE_NAMES.GREENFIELD_ONBOARD,
    category: "onboarding",
    dependsOn: [],
    feeds: [],
    purpose: "Set up product and repository context for a new project space.",
  },
  [PHASE_NAMES.CURRENT_STATE_EXPLORE]: {
    phase: PHASE_NAMES.CURRENT_STATE_EXPLORE,
    category: "exploration",
    dependsOn: [],
    feeds: [PHASE_NAMES.PRD, PHASE_NAMES.DESIGN, PHASE_NAMES.TASKS],
    purpose: "Explore the current codebase, constraints, and existing implementation before planning changes.",
  },
  [PHASE_NAMES.DOCUMENTATION_REVIEW]: {
    phase: PHASE_NAMES.DOCUMENTATION_REVIEW,
    category: "exploration",
    dependsOn: [],
    feeds: [PHASE_NAMES.PRD, PHASE_NAMES.SPEC, PHASE_NAMES.DESIGN],
    purpose: "Review existing AGENTS, README, docs, and OpenSpec coverage before writing new documentation or specs.",
  },
  [PHASE_NAMES.PRD]: {
    phase: PHASE_NAMES.PRD,
    category: "sdd",
    dependsOn: [],
    softDependsOn: [PHASE_NAMES.CURRENT_STATE_EXPLORE, PHASE_NAMES.DOCUMENTATION_REVIEW],
    feeds: [PHASE_NAMES.SPEC, PHASE_NAMES.DESIGN],
    purpose: "Describe the product problem, goals, scope, and acceptance criteria.",
  },
  [PHASE_NAMES.SPEC]: {
    phase: PHASE_NAMES.SPEC,
    category: "sdd",
    dependsOn: [PHASE_NAMES.PRD],
    feeds: [PHASE_NAMES.DESIGN],
    purpose: "Translate the PRD into source-of-truth requirements and deltas.",
  },
  [PHASE_NAMES.DESIGN]: {
    phase: PHASE_NAMES.DESIGN,
    category: "sdd",
    dependsOn: [PHASE_NAMES.SPEC, PHASE_NAMES.CURRENT_STATE_EXPLORE],
    feeds: [PHASE_NAMES.TASKS],
    purpose: "Define the technical approach using specs plus relevant current-state exploration.",
  },
  [PHASE_NAMES.TASKS]: {
    phase: PHASE_NAMES.TASKS,
    category: "sdd",
    dependsOn: [PHASE_NAMES.DESIGN, PHASE_NAMES.CURRENT_STATE_EXPLORE],
    feeds: [PHASE_NAMES.APPLY],
    purpose: "Break the design into reviewable implementation tasks with evidence expectations.",
  },
  [PHASE_NAMES.APPLY]: {
    phase: PHASE_NAMES.APPLY,
    category: "sdd",
    dependsOn: [PHASE_NAMES.TASKS],
    feeds: [PHASE_NAMES.VERIFY, PHASE_NAMES.BUGFIX_MEMORY],
    purpose: "Implement the planned tasks in code with controlled execution.",
  },
  [PHASE_NAMES.VERIFY]: {
    phase: PHASE_NAMES.VERIFY,
    category: "sdd",
    dependsOn: [PHASE_NAMES.APPLY],
    feeds: [PHASE_NAMES.ARCHIVE, PHASE_NAMES.BUGFIX_MEMORY],
    purpose: "Verify that implementation matches tasks, design, and specs.",
  },
  [PHASE_NAMES.ARCHIVE]: {
    phase: PHASE_NAMES.ARCHIVE,
    category: "sdd",
    dependsOn: [PHASE_NAMES.VERIFY],
    feeds: [],
    purpose: "Finalize the change and merge or archive its source-of-truth artifacts.",
  },
  [PHASE_NAMES.BUGFIX_MEMORY]: {
    phase: PHASE_NAMES.BUGFIX_MEMORY,
    category: "memory",
    dependsOn: [PHASE_NAMES.APPLY, PHASE_NAMES.VERIFY],
    feeds: [],
    purpose: "Save compact bugfix or decision memory after evidence exists.",
  },
};

export function getPhaseNode(phase: PhaseName): PhaseNode {
  return PHASE_GRAPH[phase];
}

export function listPhaseGraph(): PhaseNode[] {
  return Object.values(PHASE_GRAPH);
}

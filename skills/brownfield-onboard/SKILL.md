---
name: sdd-stack-brownfield-onboard
description: "Trigger: sdd stack brownfield, existing repo, existing codebase, onboard existing project. Scan shallowly and identify affected domains before planning."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-brownfield-onboard

For existing repos, start shallow:

- detect repo shape and services
- if project context is missing, create or suggest `AGENTS.md` first
- read project facts first
- inspect active specs only by reference
- identify changed domains before drafting PRD or deltas
- if OpenSpec exists, reference `openspec/specs/` and `openspec/changes/` instead of rewriting that knowledge elsewhere
- do not create a broad `README.md` unless the user explicitly asks for human-facing onboarding or general documentation
- compare what is already covered in `openspec/`, `AGENTS.md`, `README.md`, and `docs/` before recommending new files

Do not bulk-read the codebase.

If the user asks for "documentation" in a broad way, ask a clarification question before writing files.

Preferred order:
1. `AGENTS.md` for operational project context
2. `README.md` for human-facing overview/onboarding
3. `openspec/` for source-of-truth specifications
4. technical docs for modules/APIs/services

Use examples in the question itself:
- `AGENTS.md` example: stack, services, commands, testing, constraints
- `README.md` example: repo overview, setup, how to run, onboarding
- `OpenSpec` example: domains, requirements, active changes
- `Technical docs` example: endpoints, services, architecture, module notes
- `All of the above` example: make a plan and sequence the work

Recommend `AGENTS.md` first unless the user explicitly asks for README, onboarding, API docs, or broader human-facing documentation.

Recommendation logic after exploration:
- If OpenSpec already covers product behavior or active changes, say so explicitly and avoid duplicating that content in `README.md` or `AGENTS.md`.
- If `AGENTS.md` is missing, recommend it first as the operational gap.
- If `README.md` is missing, position it as the human/onboarding gap, not the default first step.
- If both OpenSpec and docs already exist, recommend only the missing surfaces.
- Summarize the gap analysis before asking what to do next.

Preferred response shape after the scan:

## Already covered
- list what is already documented in `openspec/`, `docs/`, or existing root files

## Missing or unclear
- list the actual gaps: operational context, onboarding, technical docs, etc.

## Recommended next step
- recommend ONE first move, usually `AGENTS.md` if operational context is missing

## Options
1. Create `AGENTS.md` first
2. Create `README.md` first
3. Create both in order
4. Only list gaps, do not write files yet

Do not finish with a vague free-form suggestion list when a structured choice would be clearer.

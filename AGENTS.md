# AGENTS.md

## Summary

- Project: `pi-sdd-stack`
- Type: Pi package for spec-driven development workflows
- Language: TypeScript
- Build output: `dist/`
- Package target: Pi Agent extension + skills + prompts

## Repository layout

- `src/` — package source code
  - `commands/` — Pi slash-command handlers
  - `init/` — project scanning and AGENTS generation
  - `openspec/` — schema install, impact classification, path helpers
  - `context/` — reference-first context resolution
  - `memory/` — explicit memory policy and Engram wrapper
  - `models/` — phase routing config + loader
  - `subagents/` — subagent registry and guided runner helpers
  - `brevity/` — caveman-output / brevity behavior
  - `sdd/` — phase graph and orchestration logic
- `assets/` — shipped templates, agents, policies, model defaults, OpenSpec schema
- `skills/` — package-owned skills
- `prompts/` — package-owned prompts
- `tests/` — Vitest coverage for policy and workflow boundaries
- `dist/` — compiled output

## Purpose of key surfaces

- `README.md` — human-facing package overview and installation/usage guide
- `AGENTS.md` — operational context for agents and contributors working on this repo
- `assets/openspec-schema/pi-sdd-stack/` — source of truth for the package's OpenSpec schema and templates

## Common commands

- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run unit tests with Vitest
- `npm run typecheck` — run TypeScript type checking without emitting files

## Development rules

- Keep project artifacts in English unless a specific artifact explicitly needs another language.
- Keep prompts, workflows, and package behavior original to `pi-sdd-stack`.
- Treat OpenSpec as the source of truth for PRD/spec/design/tasks/verify behavior.
- Do not reintroduce background autosave memory behavior into the core architecture.
- Prefer explicit, inspectable orchestration over hidden heuristics.

## Testing expectations

- Run `npm test` and `npm run typecheck` after meaningful changes.
- If command behavior changes, ensure `tests/extension.test.ts` still covers registration and routing expectations.
- If generation logic changes, update the relevant tests under `tests/agentsFile.test.ts`, `tests/schemaInstaller.test.ts`, or orchestration tests.

## Phase routing

- Default phase routing lives in `assets/models/default-routes.json`.
- User-level phase routing is written to `~/.pi/sdd-stack/models.json`.
- `/sdd-stack:models` is the intended control surface for per-phase `agent`, `model`, `thinking`, and `caveman-output`.
- Command name + file path keep `models` for compatibility.

## OpenSpec and orchestration

- The package models an explicit phase graph in `src/sdd/phaseGraph.ts`.
- Onboarding/documentation phases are separate from the main SDD path.
- Reusable exploration/review phases should feed PRD/design/tasks instead of being treated as one-off documentation helpers.

## Constraints

- This repo is a package repo, not a consumer app; avoid generating consumer-project files here except for tests/fixtures.
- Keep hard requirements and package behavior aligned with actual runtime capabilities in Pi.
- Keep user-facing package prompts/questions localized to the user's language at runtime, but keep repository artifacts in English.

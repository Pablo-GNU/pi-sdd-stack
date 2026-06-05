# pi-sdd-stack

![pi-sdd-stack logo](https://raw.githubusercontent.com/Pablo-GNU/pi-sdd-stack/master/logo.png)

`pi-sdd-stack` is a PRD-first SDD package for Pi Agent. It initializes a repo safely, keeps OpenSpec as the specification source of truth, and treats memory as an explicitly controlled optional layer.

## What it is

- a Pi package with `/sdd-stack:*` commands
- a project-aware `AGENTS.md` generator
- an OpenSpec schema installer for PRD -> proposal -> spec delta -> design -> tasks -> verify
- an explicit memory policy layer that only allows compact operational memory when you opt into Engram usage

## What it is not

- not a fork or clone of another agent package
- not an OpenSpec replacement
- not a hidden autosave memory system or an Engram-backed parallel spec store
- not a black-box autonomous agent; it is an orchestrated SDD stack with explicit human checkpoints

## Installation

### From npm

```bash
pi install npm:pi-sdd-stack
```

### From a local checkout

```bash
pi install /absolute/path/to/pi-sdd-stack
```

## Commands

- `/sdd-stack:doctor`
- `/sdd-stack:bootstrap-check`
- `/sdd-stack:models` — phase routing editor/inspector
- `/sdd-stack:tdd-mode`
- `/sdd-stack:status <slug>`
- `/sdd-stack:continue <slug>`
- `/sdd-stack:init`
- `/sdd-stack:prd <slug>`
- `/sdd-stack:requested-domains <slug> [domain1,domain2,...|--clear]`
- `/sdd-stack:plan <slug>`
- `/sdd-stack:apply <slug>`
- `/sdd-stack:verify <slug>`
- `/sdd-stack:archive <slug>`
- `/sdd-stack:memory-search <query>`

## `AGENTS.md` boundary

`AGENTS.md` belongs to the project. It describes the project, services, stack, commands and constraints. It is not where pi-sdd-stack stores its workflows or memory policy.

If `AGENTS.md` already exists, `pi-sdd-stack` leaves it alone and writes `.pi/sdd-stack/AGENTS.suggested.md` instead.

## OpenSpec boundary

- OpenSpec is the source of truth for PRDs, proposals, spec deltas, designs, tasks, and verification reports.
- Active feature work writes under `openspec/changes/<slug>/...`.
- Source specs under `openspec/specs/` are not edited directly during an active change.
- Follow-up changes on an existing domain should reuse that domain inside the active change delta spec path instead of inventing a parallel domain.
- Use `ADDED` when a follow-up change adds net-new capability inside an existing domain. Use `MODIFIED` only when changing an already specified requirement's semantics, constraints, or scenarios.
- `openspec/changes/<slug>/prd.md` may declare explicit domain targeting in frontmatter with `requestedDomains`, for example `requestedDomains: [client]`. When present, it takes priority over slug/summary heuristics for impact classification and change scaffolding.
- Use `/sdd-stack:requested-domains <slug>` to inspect the current value, `/sdd-stack:requested-domains <slug> client,auth` to set it, and `/sdd-stack:requested-domains <slug> --clear` to reset it to an empty list without editing the PRD manually.
- Archive is responsible for merging the approved change back to source-of-truth specs.
- OpenSpec navigation should rely on its directory conventions and CLI (`openspec list/show/status`), not on a package-owned index file.

## Optional explicit memory backend

If you choose to install the standalone `engram` binary, `pi-sdd-stack` can use it through explicit commands or controlled wrappers.

- Memory is limited to operational notes such as bug root cause, bug fix, technical decisions, gotchas, repo conventions, setup notes, and handoffs.
- PRDs, specs, designs, tasks, verify artifacts, README/AGENTS docs, and general project documentation are blocked by policy.
- The main SDD flow does not depend on Engram.

## Required runtime dependencies

`pi-sdd-stack` expects these dependencies to be installed before you use the stack:

- `@fission-ai/openspec`
- `@juicesharp/rpiv-ask-user-question`
- `@juicesharp/rpiv-todo`
- `pi-subagents`

Install commands:

```bash
npm install -g @fission-ai/openspec@latest
pi install npm:@juicesharp/rpiv-ask-user-question@latest
pi install npm:@juicesharp/rpiv-todo@latest
pi install npm:pi-subagents@latest
```

`/sdd-stack:doctor` reports missing hard requirements. Other stack commands fail fast with actionable install messages until the runtime is ready.

Use `/sdd-stack:bootstrap-check` before starting a project to see the full preflight status and exact install commands for anything missing.

## Model routing

Use `/sdd-stack:models` to open a TUI editor for per-phase routing. Command name stays `models` for compatibility.

Current routing surfaces are organized into three groups:

- Onboarding/documentation: `brownfield.onboard`, `greenfield.onboard`
- Reusable exploration/review: `current-state.explore`, `documentation.review`
- Main SDD flow: `prd`, `spec`, `design`, `tasks`, `apply`, `verify`, `archive`, `bugfix.memory`

Each phase can carry four routing/runtime controls:

- `agent` — the delegated phase agent for that phase
- `model` — the Pi provider/model to use for that phase
- `thinking` — the reasoning effort level for that phase
- `caveman-output` — the output compression/style level for that phase when Caveman is installed

## Phase graph

`pi-sdd-stack` now models the intended relationship between phases explicitly:

- `current-state.explore` feeds `prd`, `design`, and `tasks`
- `documentation.review` feeds `prd`, `spec`, and `design`
- `prd` feeds `spec` and `design`
- `spec` plus `current-state.explore` feed `design`
- `design` plus `current-state.explore` feed `tasks`
- `tasks` feeds `apply`
- `apply` feeds `verify`
- `verify` feeds `archive`
- `apply` and `verify` can feed `bugfix.memory` when operational memory is justified

Onboarding/documentation phases (`brownfield.onboard`, `greenfield.onboard`) stay separate from the main SDD path.

Use `/sdd-stack:status <slug>` to inspect the current graph state for a change, and `/sdd-stack:continue <slug>` to run the next ready orchestrated step.

- Each SDD phase gets its own `agent`, `model`, `thinking`, and `caveman-output` value.
- Models are selected from the list Pi already knows.
- Thinking can be set only when the selected model supports reasoning.
- Changes are saved to `~/.pi/sdd-stack/models.json`.
- The file stores per-phase routing overrides; path name stays `models.json` for compatibility.

## Optional output controls

If you install `pi-caveman`, `/sdd-stack:models` also applies and lets you configure `caveman-output` per phase.

Install:

```bash
pi install npm:pi-caveman@latest
```

Supported levels:

- `off`
- `lite`
- `full`
- `ultra`
- `wenyan-lite`
- `wenyan`
- `wenyan-ultra`
- `micro`

`caveman-output` controls conversational output style and compression. It does not change the selected model or reasoning effort.

## TDD mode

Use `/sdd-stack:tdd-mode` to choose how strongly the stack enforces testing during planning, apply, and verify.

- `strict` — RED -> GREEN -> REFACTOR with explicit evidence expected across tasks/apply/verify
- `standard` — tests are expected, but strict TDD is not enforced
- `off` — the stack does not require tests

This setting is stored in `~/.pi/sdd-stack/settings.yaml` and is echoed by planning/apply/verify outputs so later phases inherit the choice.

## Optional Engram install

If you want explicit memory search or future controlled memory saves, install the standalone `engram` binary separately. `pi-sdd-stack` does not require background memory packages and does not want implicit autosave behavior in the core stack.

## MVP status

This version focuses on safe initialization, schema installation, PRD/planning scaffolds, guided apply, verification scaffolds, impact classification, and strict memory policy enforcement.

# pi-sdd-stack brownfield

Scan shallowly. Build references, not giant summaries.
Identify affected domains before planning.
Prefer creating or improving `AGENTS.md` for project context.
If OpenSpec exists, point to `openspec/specs/` and `openspec/changes/`.
Do not write a broad `README.md` unless the user explicitly asks for human-facing documentation.
Before recommending a file to create, compare what is already covered in `openspec/`, `AGENTS.md`, `README.md`, and `docs/`.

When the user asks for documentation in a generic way, ask first which surface they want. Use this structure:

1. Project context (`AGENTS.md`) — stack, repo layout, commands, testing, constraints. Recommended when the goal is helping Pi work better in the repo.
2. Human overview (`README.md`) — project summary, setup, run commands, onboarding basics.
3. Specifications (`openspec/`) — domains, requirements, active changes, source-of-truth behavior docs.
4. Technical docs — endpoints, services, modules, architecture notes.
5. All of the above — create a plan and handle them in order.

Do not default to `README.md` as the recommended option. Default to `AGENTS.md` unless the user explicitly asks for onboarding or human-facing docs.
If OpenSpec already contains significant behavior/change documentation, say that explicitly and frame the missing gap as operational context (`AGENTS.md`) and/or human onboarding (`README.md`).

Preferred output structure after exploration:

## Already covered
- what is already documented in OpenSpec, docs, or root files

## Missing or unclear
- what still lacks operational context or human onboarding

## Recommended next step
- one primary recommendation

## Options
1. Create `AGENTS.md` first
2. Create `README.md` first
3. Create both in order
4. Only list gaps for now

---
name: sdd-stack-router
description: "Trigger: sdd stack, router, brownfield, greenfield, prd, plan, bugfix memory. Route pi-sdd-stack workflows and skip ceremony for tiny safe edits."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-router

Use pi-sdd-stack when a change needs product framing, spec deltas, design, tasks, or verification evidence.

Parent-session rule:
- Clarify in parent if needed.
- Once a phase is selected, do not execute that phase in the parent window.
- Launch the matching subagent or `/sdd-stack:*` command first.
- No parent `read`/`bash`/`edit`/`write` for routed phase work before delegation.

- Use brownfield onboarding when the repo already exists and operational/documentation project context is missing or stale -> delegate to subagent.
- Use current-state exploration when a feature needs technical context from existing code before PRD/design/tasks -> delegate to subagent.
- Use greenfield onboarding when the product space or repo structure is still mostly undefined -> delegate to subagent.
- Create a PRD before planning when the request is feature-sized or product-facing -> delegate to subagent.
- For very broad feature-opening prompts, prefer one free-text brief invitation before any structured questionnaire or technical exploration.
- Run PRD to SDD planning when a PRD already exists and implementation scope must become proposal/spec/design/tasks -> delegate to subagent.
- Use bugfix memory only for root cause, fix, evidence, conventions, setup notes, and handoffs -> delegate to subagent.
- Skip heavy SDD ceremony for tiny, low-risk, single-file edits with no product or behavior ambiguity.
- If the user asks to "document the project" or says documentation is incomplete, do not assume `README.md` first. Ask which documentation surface they want.
- This routing rule is semantic, not phrase-based. Apply it even when the user writes in another language or asks indirectly to understand/review the project because information feels unclear.
- For project context and agent navigation, recommend `AGENTS.md` first.
- For human onboarding, recommend `README.md`.
- For behavior requirements and technical source of truth, point to OpenSpec.
- If OpenSpec already documents behavior or changes, mention that coverage explicitly and recommend only the missing documentation surface.
- When documentation already exists in one place, avoid duplicating it in another unless the user explicitly asks.

Example clarification question:

1. Project context (`AGENTS.md`) — stack, repo layout, commands, testing, constraints.
2. Human overview (`README.md`) — what the repo is, how to run it, onboarding basics.
3. Specifications (`openspec/`) — domains, requirements, active changes.
4. Technical docs — modules, APIs, services, architecture notes.
5. All of the above — make a plan and do them in order.

Example guidance:
- If the user wants Pi to work better in the repo, choose `AGENTS.md`.
- If the user wants docs for humans joining the project, choose `README.md`.
- If the user wants source-of-truth behavior docs, choose OpenSpec.
- If OpenSpec is already populated but `AGENTS.md` is missing, recommend `AGENTS.md` first and explain that OpenSpec already covers part of the project knowledge.

When answering after documentation exploration, prefer this structure:
1. Already covered
2. Missing or unclear
3. Recommended next step
4. Structured options

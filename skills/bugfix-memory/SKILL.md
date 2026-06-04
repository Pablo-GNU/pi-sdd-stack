---
name: sdd-stack-bugfix-memory
description: "Trigger: sdd stack bugfix memory, root cause, engram memory, handoff. Save only operational memory and never store OpenSpec artifacts in Engram."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-bugfix-memory

Parent-session rule:
- Do not capture bugfix memory in parent window after routing.
- Launch bugfix-memory as subagent first.

Engram strict policy:

- save only root cause, fix, evidence, references, conventions, setup notes, or handoffs
- never save PRDs, specs, designs, tasks, or acceptance criteria
- OpenSpec paths may be referenced, but OpenSpec remains source of truth

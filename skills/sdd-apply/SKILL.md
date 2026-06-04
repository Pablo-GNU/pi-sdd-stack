---
name: sdd-stack-apply
description: "Trigger: sdd stack apply, implement change, guided implementation. Implement from referenced artifacts with evidence and no fake task completion."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-apply

Parent-session rule:
- Do not implement apply phase in parent window after routing.
- Launch apply as subagent first.

Implementation in v0.1 is guided, not autonomous by default.

- read only referenced PRD, proposal, design, tasks, and affected specs
- implement with evidence
- do not mark tasks complete without proof
- avoid using Engram as a task tracker

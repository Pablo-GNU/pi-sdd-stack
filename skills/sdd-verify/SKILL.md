---
name: sdd-stack-verify
description: "Trigger: sdd stack verify, verification, evidence map, validate change. Map requirements and tasks to evidence without rewriting specs."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-verify

Parent-session rule:
- Do not run verification phase in parent window after routing.
- Launch verify as subagent first.

Verification must map requirements and tasks to evidence.

- cite tests, commands, or manual checks
- note missing evidence clearly
- do not rewrite requirements during verification

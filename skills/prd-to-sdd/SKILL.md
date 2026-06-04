---
name: sdd-stack-prd-to-sdd
description: "Trigger: sdd stack prd to sdd, plan change, proposal spec design tasks verify archive. Transform PRDs into OpenSpec planning artifacts in order."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-prd-to-sdd

Transformation order:

`prd.md -> proposal.md -> specs/**/spec.md -> design.md -> tasks.md -> verify.md -> archive`

Rules:

- OpenSpec is the source of truth.
- Specs are deltas inside the active change.
- Design explains approach and tradeoffs.
- Tasks must be evidence-checkable.
- Verify maps requirements and tasks to evidence.

---
name: sdd-stack-impact-classification
description: "Trigger: sdd stack impact classification, delta spec, added modified removed, cross-cutting docs. Classify feature documentation impact before writing specs."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-impact-classification

Before writing docs, classify impact:

- new domain -> create new domain delta spec with ADDED requirements
- existing domain, new behavior -> create or update delta spec with ADDED requirements
- modified behavior -> use MODIFIED requirements
- removed behavior -> use REMOVED requirements
- cross-cutting feature -> update multiple domain deltas in the same change

Never edit `openspec/specs/` directly during an active feature.

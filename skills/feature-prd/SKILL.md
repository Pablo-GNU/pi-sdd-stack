---
name: sdd-stack-feature-prd
description: "Trigger: sdd stack feature PRD, product requirements, requirements doc, PRD. Create product-first PRDs with goals, users, journeys, criteria, risks, and questions."
license: Apache-2.0
metadata:
  author: PabloGNU
  version: "1.0"
---

# sdd-stack-feature-prd

Parent-session rule:
- Do not draft PRD in parent window after routing.
- Launch PRD phase as subagent first.

If the request is still at idea/brief level or the user explicitly wants to narrate the PRD together:
- do not trigger current-state exploration yet
- do not start with `ask_user_question`
- first invite one free-text brief from the user
- preferred opening: ask them to explain what they want to add, who it is for, what should happen, and any important rule or constraint
- first lock product semantics: feature definition, actor, object/entity, desired outcome, key business rule
- use code exploration only later to complement the PRD, not to guess the concept
- after the free-text brief is acceptable, run current-state exploration if technical context is needed
- only after that, ask narrower follow-up questions if gaps remain
- avoid abstract opening questions like "what problem does it solve?" when the concept is still fuzzy
- prefer concrete semantic questions in this order:
  1. what is the feature in one sentence
  2. who performs the main action
  3. on what entity/object it acts
  4. what visible result should exist for the user
  5. what key rule or constraint matters most

PRDs in pi-sdd-stack must cover:

- problem
- goals and non-goals
- users or personas
- user journeys
- acceptance criteria
- risks
- open questions

Avoid implementation detail unless it is a hard constraint.

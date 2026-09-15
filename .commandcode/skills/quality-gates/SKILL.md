---
name: quality-gates
description: "The four mandatory quality gates - ai-slop, ponytail, over-engineering, framework-patterns - to run against a diff before raising a PR in this Playwright + TypeScript framework. Use when finishing a change, reviewing one, or preparing a pull request."
argument-hint: "[the diff, branch or PR to gate]"
---

# Quality gates — mandatory before a PR

Four gates. Apply each to **your** diff, not to the repo in general, and report
the outcome in the PR body. They apply to human-written code as much as to
generated code.

This repo carries the same four gates for every other agent too —
`.claude/skills/`, `.cursor/rules/`, `.windsurf/rules/`, `.kiro/steering/` and
`.github/copilot-instructions.md`. Here they are skills; on CommandCode that
means they load on demand. The always-on mandate lives in `AGENTS.md`, which
CommandCode reads as project memory.

## Run all four, in this order

| # | Gate | The question | Full checklist |
|---|------|--------------|----------------|
| 1 | `ai-slop` | Was this generated, skimmed, and shipped? | `/skill:ai-slop` |
| 2 | `ponytail` | Does anything else in the run already record this? | `/skill:ponytail` |
| 3 | `over-engineering` | How many callers does this abstraction have? | `/skill:over-engineering` |
| 4 | `framework-patterns` | Is this still part of this framework? | `/skill:framework-patterns` |

Invoke each one for its full check list, verdict format and boundaries. They are
deliberately disjoint — do not let one gate's reassurance hide another's finding.

## Why the order matters

`ai-slop` first, because an unverified diff is not worth sizing. Then `ponytail`
(is this already recorded somewhere?) before `over-engineering` (does this new
shape have callers?) — a thing that already exists should be reused, not
reviewed for its abstraction count. `framework-patterns` last, on what survives.

## Start with the automated gates

They are the part that actually blocks, and CI runs them on every PR:

```bash
npm run lint        # ESLint, including the Playwright spec rules
npm run typecheck   # tsc --noEmit
npx playwright test # the suite
```

Run them before the four judgement gates — most `ai-slop` findings show up here
first, as a symbol that does not exist or a test that cannot fail.

## Verdict

Report each gate's outcome in the PR body. A gate that finds something is not a
failed PR — **an unreported finding is**. Fix it, or say why it stands and let
the reviewer decide.

If you introduce a genuinely new convention rather than following one, name it
and argue for it in the PR. Silent drift is what `framework-patterns` exists to
catch.

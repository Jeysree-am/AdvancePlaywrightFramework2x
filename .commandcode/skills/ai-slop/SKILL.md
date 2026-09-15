---
name: ai-slop
description: "Quality gate: catch AI-authored changes that were generated, skimmed and shipped. Run before opening or approving a PR to prove every generated line was executed, every symbol exists, and every test can actually fail."
---

# AI-slop gate

One question: **was this generated, skimmed, and shipped?**

The problem is not that a model wrote it. The problem is that nobody ran it. Slop
is unverified output presented as finished work — and it passes review precisely
because it looks confident and plausible.

Apply this gate to any diff that a model touched, before the PR is raised.

## Checks

1. **Was it executed?** Run the thing, don't read it.
   - `npm run lint` and `npm run typecheck` (both must be clean)
   - `npx playwright test <the spec you changed>` — actually runs it
   - `npx playwright test --list` if you only added specs (proves collection)
   No test was run → the gate fails, whatever the code looks like.
2. **Does every symbol exist?** `tsc` catches invented helpers, methods and
   options. If `typecheck` was not run, the import is a guess.
3. **Can every assertion fail?** A test that cannot go red is decoration.
4. **Was the page actually looked at?** Selectors must come from the live page
   (`[data-test="..."]` in the real DOM), not from a plausible guess.
5. **Is the caption honest?** The PR description must not claim behaviour that
   nothing exercises.

## Red flags in this repo

- Assertions that cannot fail: `expect(x).toBeTruthy()` on the value the test
  just built, or asserting a variable against itself.
- A spec with no assertion at all (`playwright/expect-expect` catches some).
- `test.skip(...)` added to turn a red test green. Only capability skips are
  legitimate here: `!hasCredentials()` and `!agent.isConfigured()`.
- Invented selectors — `[data-test="checkout-continue"]` that does not exist on
  the TTACart page. Reading it is not verification; running it is.
- `any`, `as unknown as`, `@ts-expect-error` or a widened type used to silence
  `tsc` instead of fixing the type.
- A new helper in `src/utils/` that duplicates one that already exists.
- Hardcoded URLs, credentials or prices instead of `@config/credentials`,
  `@utils/envConfig` or `.env`.
- Comments that narrate or sell the code ("// robust error handling") rather
  than explain a non-obvious *why*.
- Dead scaffolding: an exported function, fixture or type that nothing imports.
- Fabricated detail in prose — a "verified" claim, a made-up test result, a
  number nobody measured.

## Verdict

One line per finding, then a stop/go:

`<file>:L<line>: <what is unverified> → <how to actually verify it>`

End with `verified: <command> <result>` for each check you ran, or
`NOT VERIFIED — do not raise the PR` if you ran none.

## Boundaries

This gate judges whether the work was *checked*, not whether it was *written by
a model* — hand-written unverified code fails it just as hard. It does not
replace the other gates: sizing goes to `over-engineering`, convention drift to
`framework-patterns`, and the build/no-build ladder to `ponytail`.

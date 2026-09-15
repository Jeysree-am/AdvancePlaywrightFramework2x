---
name: over-engineering
description: "Quality gate: count the callers before keeping an abstraction. Use when reviewing a diff for speculative layers, single-use helpers, one-field options objects, one-implementation interfaces or new dependencies."
---

# Over-engineering gate

One question: **how many callers does this abstraction have?**

Count real call sites in this repository, not hypothetical future ones.

| Callers | Verdict |
|---------|---------|
| 0 | `delete:` nothing uses it |
| 1 | `inline:` at the call site and delete the abstraction |
| 2+ | keep — it earned its keep |

"Future" is not a caller. Neither is "a test I could write", "the next project"
or "when we scale". Two real call sites today is the bar.

## Where to look in this repo

- **New `src/utils/` helper** — check first: `ApiHelper` and `BookingApi` (HTTP),
  `DataGenerator` (Faker data), `envConfig` (credentials), `visualStep`
  (screenshots per step), `SchemaValidator` (Ajv), `logger` (`createLogger`).
  A near-duplicate of any of these is `delete:`.
- **New page-object method** called from exactly one spec — inline it into the
  spec, or check whether an existing method already does it.
- **New fixture** in `src/fixtures/` where a plain page object would do.
  `test-base.ts` already pre-wires every page object and four ready states
  (`invalidLogin`, `validLogin`, `loginWithInventory`, `loginWithSelectedItem`).
- **Interface or type alias with one implementer**, or an `abstract` class with
  one subclass (`BasePage` is the exception — it has seven).
- **Generic parameter with one instantiation**, e.g. `AgentDefinition<T>` whose
  `T` never appeared in the body — drop the parameter.
- **Options object where every call site sets the same one field** — take the
  value directly.
- **Config, env var or flag nobody sets** — delete the branch that reads it.
- **New dependency** where the standard library or Playwright already covers it.
  Playwright ships `expect`, `request`, fixtures, `test.step` and tracing; reach
  for those before adding a package.
- **Wrapper around Playwright** (`request`, `expect`, `test`) that adds no
  behaviour — the wrapper is the cost, not the saving.

## Format

`<file>:L<line>: <tag> <what>. <replacement>.`

Tags: `delete:`, `inline:`, `yagni:`, `stdlib:`, `native:`, `dep:`.

```
src/utils/BookingRetry.ts:L1-40: yagni: retry wrapper around an idempotent GET.
  ApiHelper.callApiWithRetry already covers it.
src/pages/CartPage.ts:L52: inline: toSubtotalText() has one caller. Read the
  locator in the spec.
```

End with the only number that matters: `net: -<N> lines possible.`
If there is nothing to cut: `Lean already. Ship.`

## Boundaries

Scope is complexity only. Correctness, security and performance are out of
scope — route them to a normal review. Does not apply fixes, only lists them.
Pairs with `ponytail` (the build/no-build ladder) and `ponytail-review`
(line-by-line tags); if a line is already covered by those, do not repeat it
here.

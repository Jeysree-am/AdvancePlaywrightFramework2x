---
name: framework-patterns
description: "Quality gate: check a change still belongs to this Playwright framework. Use before opening a PR to confirm file placement, path aliases, page objects, fixtures, credentials, logging and tagging follow the repo's existing conventions."
---

# Framework-patterns gate

One question: **is this still part of this framework?**

A change that works but invents its own layout, its own HTTP call, its own
credentials or its own logging has quietly forked the framework. Either bring it
back to the conventions below, or delete it.

## Conventions to check

**Placement** — files live where their kind lives:

| Kind | Home |
|------|------|
| UI page objects | `src/pages/` (one class per file) |
| Fixtures | `src/fixtures/` |
| Specs | `src/tests/**` (`e2e/`, `apisTests/`, `aiTests/`) |
| Shared helpers | `src/utils/` |
| Test data + JSON Schemas | `src/testdata/` (schemas in `src/testdata/schemas/`) |
| API service objects | `src/api/` |
| LLM agents | `src/ai/agents/`, client in `src/ai/client/` |
| Env access | `src/config/credentials.ts`, `src/utils/envConfig.ts` |

A `.ts` file at the repo root (other than `playwright.config.ts` /
`eslint.config.mjs`) or a helper living inside a spec is drift.

**Imports** — path aliases, never `../../`:
`@ai @api @config @fixtures @pages @testdata @utils`. A deep relative import in
`src/` is a smell; the alias exists.

**Page objects** — extend `BasePage` (`src/pages/BasePage.ts`) and use the
inherited `this.page`, `this.el` (`UtilElementLocator`), `this.log` and
`goto()`. Subclasses declare their own `private readonly` locators; BasePage
deliberately pre-builds none.

**Specs** — import `test`/`expect` from `@fixtures/test-base` (UI) or
`@fixtures/booker.fixture` (API), then ask for the page you need
(`async ({ inventoryPage, cartPage }) => …`). `new InventoryPage(page)` inside a
spec bypasses the fixture layer — a smell.

**Credentials** — `@config/credentials` or `@utils/envConfig`
(`getCredentials()` / `hasCredentials()`). Never a literal username, password or
token. A spec that needs secrets must skip cleanly when they are absent —
`test.skip(!hasCredentials(), …)` — so a keyless CI run stays green.

**Data** — `DataGenerator` (Faker) for anything random, `src/testdata/` for
fixed fixtures. Not inline literals in a spec.

**HTTP** — `ApiHelper` / `BookingApi` for REST specs, not raw `request.*` in a
new spec. Contract checks go through `SchemaValidator` plus a
`src/testdata/schemas/*.json`.

**Logging and steps** — `createLogger('<scope>')` from `@utils/logger`, and
`test.step(...)` / `visualStep(page, ...)` for readable steps. `console.log` in
a spec is drift.

**Naming and tags** — `*.spec.ts`, `test.describe('<@P0 @Regression …> <area>')`
using the existing `@P0` / `@Regression` plus layer tags. A new tag scheme needs
a reason.

**Gates** — `npm run lint` and `npm run typecheck` must both pass. The Playwright
plugin rules apply to `src/tests/**/*.spec.ts`.

## Verdict

`<file>:L<line>: <drift> → <the convention it should follow>.`

Judgements: `keep`, `relocate` (right code, wrong home), `revert` (the change
belongs outside this framework and should not land here). If the change adds a
genuinely new pattern the framework should adopt, say so explicitly and name the
convention it introduces — silent drift is the failure, an argued convention is
not.

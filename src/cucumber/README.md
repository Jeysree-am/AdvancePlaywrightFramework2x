# Cucumber (BDD) layer

A Cucumber runner that sits alongside the Playwright suite and drives the same
page objects, through a `CustomWorld` instead of Playwright fixtures. It reports
into the same TTA HTML report, so a BDD run and a Playwright run land in one
`tta-report/` history.

## Layout

```
src/cucumber/
├── tsconfig.json                    # CommonJS + the repo's @-aliases for ts-node
├── support/
│   ├── world.ts                     # CustomWorld: browser, context, page, page objects
│   ├── hooks.ts                     # Before/After browser lifecycle, AfterStep screenshots
│   ├── ttaFormatter.ts              # TTA HTML report formatter
│   └── ttaFormatter.cjs             # CJS shim cucumber loads instead of the .ts
├── level-00-Installation/
│   ├── feature/smoke.feature
│   └── steps/smoke.spec.ts
├── level-01-basic/
│   ├── feature/login.feature
│   └── steps/login.steps.ts
└── level-02-datadriven/             # empty — no feature yet
```

`cucumber.js` at the repo root is the configuration; the support folder holds the
runtime.

## Running

```bash
npm run cucumber:level0     # level-00-Installation
npm run cucumber:level1     # level-01-basic
npm run cucumber:level2     # level-02-datadriven (empty today → 0 scenarios)
npm run cucumber            # default profile: every level
npm run cucumber:headed     # every level, visible browser
```

There is no `cucumber:headless` script — see [Profiles](#profiles-and-tags).

Every `cucumber:*` script also sets `ATTACH_SCREENSHOTS=true`, so each step is
captured into the report. The plain `cucumber` script and the `test:bdd*` aliases
do not — set the variable yourself for those.

Manually, in PowerShell:

```powershell
$env:HEADED='1'                 # headed; anything other than '1' is headless
npx cucumber-js --profile level1

npx cucumber-js --tags "@negative"
npx cucumber-js --profile level1 --dry-run        # check step matching, no browser
$env:ATTACH_SCREENSHOTS='true'; npx cucumber-js --profile level1
```

`$env:` lasts the whole PowerShell session, so clear it when you are done:
`Remove-Item Env:\HEADED`. Do not put it in your `$PROFILE`.

## Profiles and tags

Profiles are the **top-level keys** of `cucumber.js`. `--profile X` selects that
one and ignores `default`, so each profile is self-contained:

| Profile | Tag filter | Feature paths |
|---------|-----------|---------------|
| `default` | none | `src/cucumber/**/*.feature` |
| `level0` | `@level0` | same |
| `level1` | `@level1` | same |
| `level2` | `@level2` | same |

**Every scenario must carry its `@levelN` tag** — on the `Feature:` or the
`Scenario:`, either works. An untagged scenario is filtered out and the run
reports `0 scenarios` with no error, which is the single most common way to get
confused here.

## Configuration (`cucumber.js`)

- **`require("dotenv").config()`** — a Cucumber process never loads
  `playwright.config.ts`, so this is what puts `.env` into `process.env`.
  Without it, `world.ts` falls back to hard-coded defaults and the reporter's
  `hasApiKey()` returns false, silently skipping the AI RCA agent. It has to run
  in the config, because `world.ts` reads `process.env` at import time.
- **`TS_NODE_PROJECT`** → `src/cucumber/tsconfig.json`, which extends the root
  config and adds `rootDir` (TypeScript 6 refuses to infer it) and the
  `@ai @api @config @fixtures @pages @testdata @tests @utils` aliases.
- **`requireModule: ["ts-node/register", "tsconfig-paths/register"]`** — compiles
  the TypeScript specs and resolves the aliases they reach transitively (page
  objects import `@utils/logger` through `BasePage`).
- **`format`** — `progress-bar` for the terminal, `html:` for a plain Cucumber
  report under `reports/cucumber/`, and the TTA formatter.
- **`snippetInterface: "async-await"`** — generated snippets use `async function`.

## World and hooks

`CustomWorld` owns the Playwright objects and is built once per scenario:

| Member | Purpose |
|--------|---------|
| `browser`, `context`, `page` | Playwright handles |
| `loginPage` … `checkoutCompletePage` | page objects, built by `initPages()` |
| `scratch` | free-form bag for values passed between steps |
| `BASE_URL`, `CREDS` | exported constants read from `.env` |

`hooks.ts` wires the lifecycle:

- **`Before`** — launches Chromium (`headless: !HEADED`), creates the context
  with `baseURL`, opens a page and calls `initPages()`.
- **`AfterStep`** — attaches a PNG per step when `ATTACH_SCREENSHOTS=true`, reusing
  the same flag as the Playwright suite's `visualStep`. No flag, no screenshots.
- **`After`** — closes the context and browser.

## Writing steps

Cucumber matches an expression against the **whole** step text, so:

- **No stray spaces** in the expression. `'I am on the page '` never matches
  `I am on the page` — a trailing space is enough to make a step undefined.
- **Await everything.** A missing `await` lets the next step race the page.
- **The wording is the contract.** Change the feature text and you must change
  the expression. `--dry-run` and the `usage` formatter both report undefined
  steps without opening a browser:
  `npx cucumber-js --profile level1 --format usage`.
- When one action is phrased several ways, register one shared function for each
  expression rather than repeating the body — see `login.steps.ts`.

Feature files use the repo's existing tag scheme (`@P0`, `@Regression`, `@smoke`,
`@negative`) plus the `@levelN` the profile filters on.

## The TTA report

`ttaFormatter.ts` maps each scenario into the same `TestData` model the Playwright
reporter builds, then calls `CustomTTAReporter.renderExternalRun`. It reuses the
report template, the RCA/flaky pipeline and the `tta-report/` history — nothing
about the report is duplicated for Cucumber.

- Scenario → test row; gherkin steps → steps. `Before`/`After` hooks are excluded
  (a Cucumber `5 steps` is often 3 gherkin steps plus 2 hooks).
- Status mapping: `PASSED` → passed; `FAILED`, `AMBIGUOUS`, `UNDEFINED` → failed;
  `SKIPPED`, `PENDING`, `UNKNOWN` → skipped. Undefined steps read as failures
  because the run exits non-zero.
- Screenshots are read from step attachments and written to
  `tta-report/screenshots/`, like the Playwright path.
- A retried attempt (`willBeRetried`) is excluded from the results and counted as
  flaky.

**`ttaFormatter.cjs` is not optional.** Cucumber resolves formatters through
native ESM, which cannot load a `.ts` module, so the shim registers ts-node and
re-exports the compiled class. Point the `format` entry at the `.cjs`, never the
`.ts`.

Outputs:

| Path | What |
|------|------|
| `tta-report/report_<YYYYMMDD_HHMMSS>.html` | the run |
| `tta-report/index.html` | redirect to the latest run |
| `tta-report/history.html` | every run, newest first |
| `tta-report/screenshots/` | step screenshots |
| `tta-report/.cucumber-tta.log` | the formatter's own stream |
| `reports/cucumber/report.html` | plain Cucumber HTML report |

The run id must stay in `YYYYMMDD_HHMMSS` form — `history.html` parses filenames
with that pattern and silently drops anything else.

## Gotchas

- **`0 scenarios` almost always means one of two things:** the feature file is
  empty, or the scenario is missing its `@levelN` tag.
- **`dotenv` does not override existing variables.** If your shell already holds
  a `GROQ_API_KEY`, that value wins over `.env`. Clear it if you rotate the key.
  `playwright.config.ts` behaves the same way.
- `level-02-datadriven/` has no feature yet, so `cucumber:level2` reports
  `0 scenarios` — that is expected, not a failure.
- `level-00-Installation/steps/smoke.spec.ts` is a step definition despite the
  `.spec.ts` name. It is outside Playwright's `testDir` so it is never collected,
  but `*.steps.ts` would be clearer.
- `npm run test:bdd:report` and `test:bdd:tta` use `open`, which is macOS-only —
  on Windows use `Start-Process tta-report\index.html`.
- **Screenshots cost memory** — every step snapshots the page, which is meaningful
  on a small machine. To keep failure evidence without the per-step cost, gate the
  `AfterStep` hook in `hooks.ts` on the step result's status.

## Gates

Same as the rest of the repo — the Cucumber layer is covered by the root
`tsconfig.json` and by ESLint:

```bash
npm run lint
npm run typecheck
npx playwright test
```

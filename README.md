# AdvancePlaywrightFramework2x

A Playwright + TypeScript end-to-end testing framework for the TTACart demo
storefront (SauceDemo-style), built around Page Object Model (POM), custom
fixtures, environment-driven configuration via dotenv, and rich HTML reporting.

## Tech stack

| Tool | Purpose |
|------|---------|
| [Playwright](https://playwright.dev) (`@playwright/test` ^1.62) | Test runner + browser automation |
| TypeScript | Specs, page objects, fixtures, and utilities |
| dotenv | Environment variables loaded from `.env` |
| Winston | Scoped logging to console + `logs/combined.log` |
| Faker | Random test data (`DataGenerator`) |
| Ajv + ajv-formats | JSON Schema (contract) validation |
| Allure Playwright | Allure integration (installed) |
| [ESLint](https://eslint.org) (`eslint` ^10) + [typescript-eslint](https://typescript-eslint.io) + [eslint-plugin-playwright](https://github.com/playwright-community/eslint-plugin-playwright) | Static analysis for the TypeScript sources and Playwright spec rules |

The framework also ships an optional **AI layer** (see [AI layer](#ai-layer)) — a
provider-agnostic LLM client plus four schema-validated agents — and a custom TTA
HTML reporter that surfaces their output.

Every change to this repo passes four mandatory **quality gates** before it is
reviewable, and the same gates are configured for every AI assistant that might
write the change — Copilot, Claude Code, Cursor, Windsurf, Kiro, OpenCode and
CommandCode. See [Quality gates](#quality-gates).

## Project structure

```
src/
├── ai/                         # AI layer (see "AI layer")
│   ├── agents/                 # Agent definitions (prompt + output schema)
│   │   ├── createAgent.ts      # Agent factory: JSON + Ajv validation + repair round
│   │   ├── testDataAgent.ts    # Booking test-data generator
│   │   ├── rcaAgent.ts         # Failure triage verdict
│   │   ├── flakyAnalyzer.ts    # Flaky diff + one-paragraph summary
│   │   └── selfHealingAgent.ts # Locator-healing suggestion (advisory)
│   ├── client/
│   │   ├── LLMClient.ts        # Provider-agnostic chat client
│   │   ├── adapters.ts         # Wire adapters (openai-completions, anthropic-messages)
│   │   └── types.ts
│   └── config/
│       └── providers.ts        # Provider registry + env resolution + hasApiKey()
├── config/
│   └── credentials.ts          # Credentials helper (STANDARD_USER / TTA_SECRET)
├── api/
│   └── BookingApi.ts           # Restful Booker service object (API layer)
├── fixtures/
│   ├── test-base.ts            # Custom test with page-object fixtures & app states
│   └── booker.fixture.ts       # bookingApi + bookerToken fixtures (API layer)
├── pages/                      # Page Object Model classes
│   ├── BasePage.ts             # Shared page scaffolding (page, el, log, goto)
│   ├── LoginPage.ts
│   ├── InventoryPage.ts
│   ├── ItemDetailPage.ts
│   ├── CartPage.ts
│   ├── CheckoutStepOnePage.ts
│   ├── CheckoutStepTwoPage.ts
│   └── CheckoutCompletePage.ts
├── testdata/
│   ├── logintestdata.json      # Login user test data
│   ├── booking.data.ts         # Booking payload factories (API layer)
│   └── schemas/                # JSON Schema contracts for API + AI agents
├── tests/                      # Specs: login.spec.ts, e2e/*, apisTests/*, aiTests/*
│   ├── apisTests/              # Pure API specs (run under the api project)
│   └── aiTests/                # AI-agent specs (run under the ai project)
└── utils/
    ├── DataGenerator.ts        # Faker-backed test data
    ├── UtilElementLocator.ts   # Reusable action wrappers
    ├── ApiHelper.ts            # request-fixture wrapper (API layer)
    ├── SchemaValidator.ts      # Reusable Ajv wrapper (validate / assertValid)
    ├── envConfig.ts            # Env-driven credential accessor (getCredentials)
    ├── logger.ts               # Winston logger
    ├── visualStep.ts           # test.step wrapper with optional screenshots
    └── CustomReporter.ts       # Custom TTA HTML reporter
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the template and fill in your values:

```bash
cp .env.example .env
```

The env spec (`e2e-checkout-env.spec.ts`) reads credentials from the
environment via `src/utils/envConfig.ts`:

| Env var | Required? | Default in `.env.example` | Used for |
|---------|-----------|---------------------------|----------|
| `STANDARD_USER` | Yes | `standard_user` | Login username |
| `TTA_SECRET` | Yes | `tta_secret` | Login password |

Missing credentials make the env-driven spec **skip** rather than fail — the
same convention the AI specs use — so a checkout without a `.env` (CI, for
example) still collects every other test and stays green. The suite is reported
as skipped, so it is visibly not executed rather than silently passing.
`getCredentials()` still throws if it is ever called while the vars are unset.

> Note: TTACart accepts a fixed set of users (e.g. `standard_user`,
> `locked_out_user`, `problem_user`) — all with the password `tta_secret`.

Other env vars the framework reads: `TTA_ENV`, `BASE_URL`, `QA_BASE_URL`,
`STG_BASE_URL`, `PROD_BASE_URL`, `DEV_BASE_URL`, `API_BASE_URL`, `LOG_LEVEL`,
`TEST_ENV`, `TEST_AUTHOR`, and `ATTACH_SCREENSHOTS`.

The AI layer is configured separately with `LLM_PROVIDER` plus the matching
provider key — see [AI layer](#ai-layer). None of the AI env vars are required:
an unconfigured provider makes the AI specs skip rather than fail.

### 3. Run the tests

```bash
# All tests
npx playwright test

# A single spec
npx playwright test src/tests/e2e/e2e-checkout.spec.ts

# Env-driven checkout spec (credentials from .env)
npx playwright test src/tests/e2e/e2e-checkout-env.spec.ts

# A tagged suite (@P0)
npx playwright test --grep "@P0"

# Headless locally (CI sets this automatically)
CI=true npx playwright test --project=chromium
```

> Browser mode follows the `CI` variable (`headless: !!process.env.CI`): local
> runs are headed, CI runs are headless. In PowerShell set it with
> `$env:CI='true'` before the command. Set `ATTACH_SCREENSHOTS=true` in `.env`
> to attach step screenshots to the TTA report.

### 4. Lint

Static analysis uses **ESLint 10** with the flat config in `eslint.config.mjs` at
the repo root. Three layers of rules apply:

| Files | Rules applied |
|-------|---------------|
| `**/*.{js,mjs,cjs}` (includes `eslint.config.mjs`) | `@eslint/js` recommended |
| `**/*.{ts,mts,cts}` (`src/**`, `playwright.config.ts`) | `@eslint/js` + `typescript-eslint` recommended (non-type-checked) |
| `src/tests/**/*.spec.ts` | additionally `eslint-plugin-playwright`'s `flat/recommended` |

The generated artifact folders (`node_modules/`, `playwright-report/`,
`test-results/`, `reports/`, `tta-report/`, `logs/`) are ignored. Conditional
`test.skip(...)` calls are allowed because the AI and credential-driven specs
skip — rather than fail — when their inputs are absent; an unconditional
`.skip()`/`.fixme()` is still an error.

Run the check manually:

```bash
# Lint the whole repo
npm run lint

# Lint and auto-fix everything that is fixable (spacing, etc.)
npm run lint:fix

# Lint a single file or a folder
npx eslint src/utils/logger.ts
npx eslint src/tests/e2e

# Lint only the Playwright specs (the extra plugin rules)
npx eslint "src/tests/**/*.spec.ts"
```

To install the tooling by hand (already in `devDependencies`, so a plain
`npm install` is normally enough):

```bash
npm install --save-dev eslint @eslint/js typescript-eslint eslint-plugin-playwright
```

If `NODE_ENV=production` is set in your shell, npm skips devDependencies — use
`npm install --include=dev` to install the linter in that case.

CI runs `npm run lint` as its own step before the browser install, so a lint
error fails the build before any test executes.

The config itself:

```js
// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'reports/**',
      'tta-report/**',
      'logs/**',
    ],
  },

  // JavaScript sources validated by ESLint:
  //   * eslint.config.mjs itself
  //   * any other .js / .mjs / .cjs file in the repo (none today)
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },

  // TypeScript sources validated by ESLint:
  //   * src/**/*.ts            (specs, page objects, fixtures, utils, AI layer)
  //   * playwright.config.ts   (repo root)
  {
    files: ['**/*.{ts,mts,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // A leading underscore marks a deliberately unused binding, e.g.
      // CustomReporter.onEnd's `_result` (part of the reporter interface).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Playwright specs get the plugin's recommended rules on top of the above.
  {
    files: ['src/tests/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Conditional skips are deliberate here: without an LLM key or
      // credentials the suite reports "skipped" instead of failing offline.
      // Unconditional .skip()/.fixme() still error.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
    },
  },
);
```

### 5. Typecheck

The second automated gate is `tsc --noEmit`: it type-checks `src/**` and
`playwright.config.ts` against `tsconfig.json` (strict mode, `@/*` path aliases)
and emits nothing.

```bash
# Type-check the whole project
npm run typecheck
```

This matters because the Playwright runner transpiles the specs without
type-checking them, so a broken type would otherwise only show up at runtime.

`tsconfig.json` sets `"ignoreDeprecations": "6.0"` because TypeScript 6 still
accepts the legacy `moduleResolution: "node"` and `baseUrl` options but flags
them; both stop working in TypeScript 7, so the follow-up is to migrate to
`moduleResolution: "bundler"` (or `node16`) and drop `baseUrl`.

CI runs `npm run lint` and then `npm run typecheck`, both before the browser
install, so either failure stops the build before any test executes.

## Quality gates

Every pull request in this repository passes through **four quality gates** plus
the automated CI gates. They are the primary check on a PR: a change is not ready
for review until each gate has been applied to *its* diff and the outcome
reported. Nothing is exempt — not a one-line fix, not a docs-only change.

The gates are deliberately written for both audiences at once. They apply to
human-written code exactly as much as to code produced by GitHub Copilot, Claude
Code, Cursor, Windsurf, Kiro, OpenCode, CommandCode or any other assistant, and
each of those tools is configured to read them (see
[Where the rules live](#where-the-rules-live)).

### The four gates

| # | Gate | The question it answers | What it catches |
|---|------|-------------------------|-----------------|
| 1 | `ai-slop` | Was this generated, skimmed, and shipped? | Unverified output: an import that does not resolve, a test that cannot fail, a selector nobody looked at, a claim no test exercises, `any` used to silence `tsc`, a `test.skip` added to hide a red test |
| 2 | `ponytail` | Does anything else in the run already record this? | Reinventing what `src/utils/`, `src/pages/`, `src/fixtures/` or Playwright already provide |
| 3 | `over-engineering` | How many callers does this abstraction have? | Speculative layers: code with 0 callers, a helper with 1, an interface with one implementer, an options object nobody varies, a new dependency the standard library already covers |
| 4 | `framework-patterns` | Is this still part of this framework? | Drift: files outside the expected home, deep `../../` imports where an alias exists, page objects that skip `BasePage`, specs that bypass the fixtures, hardcoded credentials |

Each gate has its own verdict format:

- `ai-slop` — `file:L<line>: <what is unverified> → <how to verify it>`, then
  `verified: <command> <result>`, or `NOT VERIFIED — do not raise the PR`.
- `over-engineering` — `file:L<line>: <tag> <what>. <replacement>.` ending in
  `net: -<N> lines possible.` (or `Lean already. Ship.`).
- `framework-patterns` — `keep`, `relocate` (right code, wrong home) or `revert`.
- `ponytail` — the change is either the shortest thing that works, or it says in
  one line what it skipped and when to add it.

A gate that finds something is **not** a failed PR. An unreported finding is.
Fix it, or state why it stands and let the reviewer decide.

### The automated gates

These are the gates CI enforces mechanically. They run on every push and must be
green:

```bash
npm run lint        # ESLint 10 - typescript-eslint + the Playwright spec rules
npm run typecheck   # tsc --noEmit
npx playwright test # the suite
```

Sections [4. Lint](#4-lint) and [5. Typecheck](#5-typecheck) above cover the
first two. In the workflow, lint and typecheck run as their own steps *before*
the browsers are installed, so a lint or type error fails the build in seconds
instead of after a browser download.

### What happens when a PR is raised

1. **CI runs the automated gates first.** Lint, then typecheck, then the suite. A
   red gate stops the PR before it reaches a reviewer — no human time is spent on
   a change that does not compile, does not lint, or does not pass its own test.
2. **The four judgement gates are applied to the diff** by the author or the
   assistant that produced it, and their outcomes are reported in the PR
   description. Each finding is either fixed or explicitly justified.
3. **The review is about judgement, not hygiene.** By the time a person reads the
   PR, the mechanical questions have been answered: does it compile, does it run,
   is it already recorded elsewhere, does it still belong to this framework. What
   is left for the reviewer is the question the gates cannot answer — *is this
   the right change?*

That is what keeps quality from eroding: the gates are cheap, they run on every
PR, and none of them can be skipped with "it's only a small change".

### Where the rules live

Each tool needs its own file, because the tools do not share one mechanism. The
same four gates are written into every file below, so whichever assistant works
on this repo, it reads the same rules:

| Tool | File it reads | How it is loaded |
|------|---------------|------------------|
| CommandCode | `AGENTS.md` + `.commandcode/skills/` | `AGENTS.md` is project **memory**, re-read every turn; the gate skills load on demand, e.g. `/skill:quality-gates` |
| OpenCode | `AGENTS.md` | its native rules file |
| GitHub Copilot | `.github/copilot-instructions.md` | repository custom instructions |
| Claude Code | `.claude/skills/quality-gates/SKILL.md` | Agent Skill |
| Cursor | `.cursor/rules/quality-gates.mdc` | project rule, `alwaysApply: true` |
| Windsurf | `.windsurf/rules/quality-gates.md` | workspace rule, `trigger: always_on` |
| Kiro | `.kiro/steering/quality-gates.md` | steering document, `inclusion: always` |

`AGENTS.md` also covers the other `AGENTS.md`-aware agents (Codex, Amp, Devin,
Jules and friends), so the table is the set of tools that need a file of their
own — not the whole audience.

For CommandCode the four gates are additionally invocable skills:
`/skill:quality-gates` runs the summary, and `/skill:ai-slop`,
`/skill:ponytail`, `/skill:over-engineering` and `/skill:framework-patterns`
carry the full checklists.

> **Keeping them in sync.** Because every tool needs its own path, the gate text
> exists as several copies of plain Markdown. Nothing warns you when they drift —
> when you change a gate, change it in every file in the table.

### Running the gates by hand

The automated gates, in the order CI runs them:

```bash
npm run lint
npm run typecheck
npx playwright test
```

The four judgement gates, in the order they should be applied — `ai-slop` first
(an unverified diff is not worth sizing), then `ponytail` (is it already
recorded?) before `over-engineering` (does the new shape have callers?), then
`framework-patterns` on whatever survives:

- **CommandCode** — `/skill:ai-slop`, `/skill:ponytail`,
  `/skill:over-engineering`, `/skill:framework-patterns`
- **Anything else** — open the matching file from the table above and follow it

## Specs

| Spec | Description |
|------|-------------|
| `login.spec.ts` | Valid-credentials login flow (@P0) |
| `e2e/e2e-checkout.spec.ts` | Full checkout flow using hardcoded creds |
| `e2e/e2e-checkout-env.spec.ts` | Full checkout flow with credentials injected from the environment |
| `apisTests/01_restfulbooker_raw/05_crud.spec.ts` | Restful Booker CRUD lifecycle (token -> create -> update) as a serial suite |
| `apisTests/02_restfulbooker_apiHelper/update-booking.spec.ts` | Update a booking through the `ApiHelper` wrapper |
| `apisTests/03_restfulbooker_fixture_e2e_api/booking-crud-e2e.spec.ts` | Booking lifecycle where the token comes from the `bookerToken` fixture |
| `apisTests/05_ajv_json_schema/create-booking-json-schema.spec.ts` | Create Booking response validated against a JSON Schema contract (positive + negative) |
| `aiTests/create-booking-ai-data.spec.ts` | Booking payload generated by an LLM agent, then validated and POSTed |
| `aiTests/rca-agent.spec.ts` | Root-cause / triage verdict for a sample failure |
| `aiTests/flaky-analyzer.spec.ts` | Offline flaky diff plus an optional LLM summary |
| `aiTests/self-healing-agent.spec.ts` | Locator-healing suggestion applied to the live login page |

## Fixtures (`src/fixtures/test-base.ts`)

Custom `test` with page objects pre-wired, plus reusable app states:

- `validLogin` — logs in as the standard user
- `invalidLogin` — logs in as `locked_out_user` and asserts the error
- `loginWithInventory` — logged in, inventory loaded
- `loginWithSelectedItem` — logged in, one item added to cart

## Reporting

- `--reporter=html` — Playwright HTML report (`playwright-report/`)
- Custom TTA reporter — console summary + `tta-report/` HTML runs. `onEnd`
  rebuilds `index.html` and renders these top-level tabs:
  - **📋 Test Results** — the test table and screenshots
  - **🤖 AI Data** — payloads attached by the test-data agent
  - **⚖️ AI Verdict** — RCA triage for failed tests (when a provider is set)
  - **🔁 Flaky** — flaky diff between the previous and current build
  - **🩹 Self-Healing** — locator-healing suggestions attached by the agent
- Winston logs — console + `logs/combined.log`

## Utilities

- `DataGenerator` — `Credentials()`, `CheckoutCustomer()`, `userProfile()` etc.
- `UtilElementLocator` — `click`, `fill`, `getText`, `waitForVisible`, ... with
  default 15s action timeouts
- `visualStep(page, title, fn)` — `test.step` that optionally screenshots each
  step for the TTA report
- `envConfig.getCredentials()` — typed, fail-fast credential accessor

## Test data

`src/testdata/logintestdata.json` lists the TTACart users used by the state
fixtures (`standard_user`, `locked_out_user`, `problem_user`,
`performance_glitch_user`, `error_user`, `visual_user`).

## REST API testing (Restful Booker)

Pure API specs live under `src/tests/apisTests/` and are collected **only** by
the `api` project (`testDir: './src/tests/apisTests'`). The `chromium` (browser)
project excludes that folder — and `aiTests/` — with
`testIgnore: /apisTests|aiTests/`, so every spec runs exactly once instead of
once per project.

```
src/tests/apisTests/
├── 01_restfulbooker_raw/            # Raw Playwright `request` fixture usage
│   ├── basic_ping.spec.ts
│   ├── 02_Post_operation.spec.ts
│   ├── 03_newcontext_api.spec.ts
│   ├── 04_put_operation.spec.ts
│   └── 05_crud.spec.ts              # token -> create -> update (serial suite)
├── 02_restfulbooker_apiHelper/      # Specs on the ApiHelper wrapper
│   ├── create-booking.spec.ts
│   └── update-booking.spec.ts
├── 03_restfulbooker_fixture_e2e_api/
│   └── booking-crud-e2e.spec.ts     # Lifecycle with a fixture-provided token
├── 04_jsonpath_plus/                # (placeholder for upcoming JSONPath specs)
└── 05_ajv_json_schema/
    └── create-booking-json-schema.spec.ts  # Response validated against a JSON Schema
```

The base URL defaults to `https://restful-booker.herokuapp.com` and can be
overridden with `API_BASE_URL`.

```bash
# API specs only
npx playwright test --project=api

# One spec
npx playwright test src/tests/apisTests/03_restfulbooker_fixture_e2e_api/booking-crud-e2e.spec.ts
```

### Building blocks

- `src/utils/ApiHelper.ts` — thin wrapper over the `request` fixture
  (`get/post/put/patch/delete` with `{ headers, data, params }`), plus retry and
  JSON-parsing helpers. Request bodies must be nested under `data`, e.g.
  `api.post('/auth', { data: { username, password } })`.
- `src/api/BookingApi.ts` — Restful Booker service object (`getToken`,
  `createBooking`, `updateBooking`, `deleteBooking`, ...) with a self-renewing
  token that re-auths once and retries on a 403.
- `src/fixtures/booker.fixture.ts` — extends `test` with `bookingApi` and
  `bookerToken` fixtures.
- `src/testdata/booking.data.ts` — `buildBooking()` and
  `buildBookingFromGenerator()` payload factories built on `DataGenerator`.
- `src/utils/SchemaValidator.ts` — reusable Ajv wrapper. `validate()` returns
  `{ valid, errors, errorText }`; `assertValid()` throws a `ValidationError`.
  One Ajv instance (with `ajv-formats`) is shared and compiled validators are
  cached, and it runs with `strict: false` so schemas may carry optional
  keywords.

### Contract testing (JSON Schema)

`apisTests/05_ajv_json_schema/` asserts the Create Booking response has the exact
shape the framework depends on. It also has a negative case that corrupts a
**real** response in memory and proves the schema rejects it — Restful Booker
accepts a booking without `lastname` and returns `200`, so the missing field is a
contract violation the schema, not the API, must catch.

```bash
npx playwright test src/tests/apisTests/05_ajv_json_schema --project=api
```

Schemas live in `src/testdata/schemas/`. `create-booking.schema.json` describes
the response (`bookingid` + `booking`); `additionalProperties: false` at every
level means a renamed or unexpected field fails rather than passing silently.
See `notes.md` in the spec folder for the full request/response trace.

### Ordering dependent API calls

`fullyParallel: true` means separate `test()` blocks in one file can run in
different workers and cannot share module-level state. Keep dependent steps
(token, create, update, delete) in a single `test()` with `test.step(...)` or in
a `test.describe.serial(...)` suite — otherwise the token or booking id arrive
as `undefined`.

## AI layer

Specs under `src/tests/aiTests/` (the `ai` project) exercise four agents built on
a provider-agnostic LLM client. The layer is a single interface —
**a prompt plus an output schema** — so adding an agent is a new file, not new
plumbing, and swapping providers is an `.env` change, not a code change.

```
src/tests/aiTests/
├── create-booking-ai-data.spec.ts   # testDataAgent -> validated payload -> POST /booking
├── rca-agent.spec.ts                # failure triage verdict
├── flaky-analyzer.spec.ts           # offline diff + optional LLM summary
├── self-healing-agent.spec.ts       # locator heal, applied to the live page
└── notes.md                         # agent-by-agent design notes
```

### Providers

Set `LLM_PROVIDER` and the matching key in `.env`. Every provider speaks the
OpenAI-completions wire today; `LLM_WIRE` can override to `anthropic-messages`.

| `LLM_PROVIDER` | Key env var | Default model |
|----------------|-------------|---------------|
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| `openrouter` | `OPENROUTER_API_KEY` | `deepseek/deepseek-chat` |
| `groq` | `GROQ_API_KEY` | `openai/gpt-oss-120b` |
| `commandcode` | `command_api_key` | `deepseek/deepseek-v4-flash` |

Optional overrides (any provider): `LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`,
`LLM_WIRE`. The registry lives in `src/ai/config/providers.ts` — one entry adds a
provider. `hasApiKey()` never throws; an unknown or half-configured provider is
simply "not configured".

### Agents

| Agent | Purpose | Schema |
|-------|---------|--------|
| `testDataAgent` | Generate a valid booking payload from a brief | `create-booking-payload.schema.json` |
| `rcaAgent` | Triage a failed test into severity / cause / fixes | `rca-verdict.schema.json` |
| `flakyAnalyzer` | Decide flakiness (pure, offline) + summarise it | `flaky-analysis.schema.json` |
| `selfHealingAgent` | Suggest a healed selector (advisory only) | `self-healing.schema.json` |

`createAgent()` supplies the plumbing for all of them: build the JSON request,
`extractJson` from the reply (fenced or bare), validate with `SchemaValidator`,
and send Ajv errors back for **one repair round** before throwing
`AgentOutputError`. Output is never trusted until it satisfies the schema. The
agent's client is built lazily on first use, so importing an agent (as
`CustomReporter` does) can't crash on a misconfigured environment.

The `selfHealingAgent` is advisory — it **never writes to source files**; it
returns a suggestion that the spec applies to the live page and asserts is
visible.

### Running

```bash
# AI specs only (skip cleanly when no key is configured)
npx playwright test --project=ai

# One agent
npx playwright test src/tests/aiTests/rca-agent.spec.ts --project=ai --reporter=list
```

### Behavior without a key

An unconfigured provider (no key, or an unusable base URL) makes `isConfigured()`
false, so the key-gated AI specs **skip** and the run exits 0 — no fallback data
is substituted. The deterministic parts (the flaky diff, the schema-sync check)
still run. This keeps a keyless CI checkout green without pretending the agent
ran.

See `src/tests/aiTests/notes.md` for the per-agent flows, schemas, and reporter
wiring.

## Notes

- `.env` is git-ignored — secrets stay out of version control. Use
  `.env.example` as the template (placeholders only; never put a real key in it).
- Generated artifacts (`playwright-report/`, `test-results/`, `reports/`,
  `tta-report/`, `logs/`) are git-ignored.

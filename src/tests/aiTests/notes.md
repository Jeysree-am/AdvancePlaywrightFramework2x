# AI-generated booking data — notes

Covers `create-booking-ai-data.spec.ts` and the AI layer it exercises. This spec is a
**replica** of `apisTests/05_ajv_json_schema/create-booking-json-schema.spec.ts`: the
contract checks are identical, but the booking payload is produced by an LLM agent instead
of `buildBooking()`. The original spec is not modified.

## Files involved

| File | Role |
|------|------|
| `src/tests/aiTests/create-booking-ai-data.spec.ts` | The spec (positive + negative cases) |
| `src/ai/agents/testDataAgent.ts` | The booking test-data agent (prompt + schema) |
| `src/ai/agents/createAgent.ts` | Agent factory: prompt + schema → validated output |
| `src/ai/client/LLMClient.ts` | Provider-agnostic chat client |
| `src/ai/client/adapters.ts` | Wire adapters (`openai-completions`, `anthropic-messages`) |
| `src/ai/config/providers.ts` | Provider registry + env resolution + `hasApiKey()` |
| `src/testdata/schemas/create-booking.schema.json` | The contract (reused, not duplicated) |
| `src/utils/SchemaValidator.ts` | Ajv wrapper used for both payload and response checks |
| `src/api/BookingApi.ts` | `createBooking()` service method |

## Testcase flow

```
TC#1  the generated payload satisfies the contract and the API accepts it
  ├─ generateBookingData(brief)             # LLM -> JSON -> Ajv-validated Booking
  ├─ validator.validate(payload, bookingSchema)   # payload matches the contract
  ├─ bookingApi.createBooking(payload)      # POST /booking  -> 200 + bookingid
  ├─ validator.validate(response, fullSchema)     # response matches the contract
  └─ testInfo.attach('ai-data', ...)        # feeds the TTA report's "AI Data" tab

TC#2  a response missing a required field is rejected
  ├─ generateBookingData()
  ├─ bookingApi.createBooking(payload)
  ├─ delete booking.lastname                # corrupt the response in memory
  ├─ validator.validate(response, fullSchema)
  └─ expect(errorText).toContain('lastname')
```

TC#2 is built by corrupting a real response rather than sending bad data, for the same
reason as the original spec: Restful Booker accepts a booking without `lastname`, so the
API returns 200 — the missing field is a *contract* violation, which is the schema's job
to catch.

## How the payload is validated against `create-booking.schema.json`

That file describes the **response** (root requires `bookingid` + `booking`), while a
generated payload is just the booking request body. So the agent's output schema is taken
from the file's own `booking` definition — `properties.booking` — and the live response is
validated against the whole file. One schema, two checks, nothing duplicated.

## Providers

The client is provider-agnostic. Set `LLM_PROVIDER` and the matching key in `.env`:

| `LLM_PROVIDER` | Key env var | Default model | Wire |
|---|---|---|---|
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` | openai-completions |
| `openrouter` | `OPENROUTER_API_KEY` | `deepseek/deepseek-chat` | openai-completions |
| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | openai-completions |
| `commandcode` | `command_api_key` | `deepseek/deepseek-v4-flash` | openai-completions |

`commandcode` targets the [Command Code Provider API](https://commandcode.ai/docs/provider)
at `https://api.commandcode.ai/provider/v1`, reading `command_api_key`. Note that Command
Code's **Go plan has no API access** — the endpoint answers `403 upgrade_required` — so a
GOAT/Pro/Max/Team/Provider plan (or a different provider key) is needed to run the agent
live. Set `COMMAND_CODE_BASE_URL` only to point at a different endpoint.

Optional overrides: `LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_WIRE`.

Swapping providers is an `.env` change only — no code edits.

## Running

```bash
# AI spec only (skips cleanly when no key is configured)
npx playwright test src/tests/aiTests --project=ai --reporter=list

# With a provider, e.g. Groq
#   .env:  LLM_PROVIDER=groq
#          GROQ_API_KEY=...
npx playwright test --project=ai
```

## Behavior without a key

If the active provider has no key (or `commandcode` has no base URL), the agent reports
itself as not configured, the tests are **skipped**, and the run exits 0. Nothing is
generated and no fallback data is substituted, so a keyless CI checkout stays green
without silently pretending the agent ran.

## Adding the next agent

An agent is a prompt plus an output schema:

```ts
export const myAgent = createAgent<MyType>({
    name: 'my-agent',
    systemPrompt: '…',
    outputSchema: mySchema,   // any Ajv schema
});
```

`createAgent` handles the JSON request, parsing, Ajv validation, and one repair round on
invalid output. No new plumbing.

---

# Agents: RCA, Flaky Analyzer, Self-Healing

Three further agents, each with its own JSON Schema under `src/testdata/schemas/` and its
own spec in this folder.

| Spec | Agent | Schema |
|------|-------|--------|
| `rca-agent.spec.ts` | `@ai/agents/rcaAgent` | `rca-verdict.schema.json` |
| `flaky-analyzer.spec.ts` | `@ai/agents/flakyAnalyzer` | `flaky-analysis.schema.json` |
| `self-healing-agent.spec.ts` | `@ai/agents/selfHealingAgent` | `self-healing.schema.json` |
| `create-booking-ai-data.spec.ts` | `@ai/agents/testDataAgent` | `create-booking-payload.schema.json` |

## RCA agent (`analyzeFailure`)

Takes a failure (`title`, `file`, `error`, `stack`) and returns a triage verdict:

```json
{
  "severity": "critical | high | medium | low",
  "priority": "P0",
  "rootCause": "…",
  "fixes": ["…"]
}
```

`severity` is constrained to those four values because `CustomReporter` maps them to the
`.sev-critical` … `.sev-low` badge classes.

`CustomReporter.onEnd` calls `analyzeFailure` for every failed test (capped at 10, each in
its own try/catch) when a provider is configured, and renders the results in the
**⚖️ AI Verdict** tab.

## Flaky analyzer (`analyzeFlaky`, `diffBuilds`)

Deliberately split in two:

- **`diffBuilds(prev, curr)` is pure and offline** — it decides which tests are flaky. A
  test is flaky when it appears in both builds and its status *changed* between two
  conclusive states (`passed` / `failed` / `timedOut`). Transitions involving `skipped` are
  not flakiness. `counts.failing` is the number failing in the newer build; `counts.total`
  is the newer build's test count.
- **`analyzeFlaky(prev, curr, hasApiKey)`** wraps that result and only then asks the LLM for
  the one-paragraph `summary`. Flaky *detection* never depends on a model, and the function
  never throws — a failed summary degrades to a result without prose. That matters because
  `CustomReporter` calls it from `onEnd` with no surrounding try/catch.

The spec asserts the diff logic unconditionally (no key, no network), then the summary
separately when a provider is configured.

## Self-healing agent (`suggestHealing`)

**Advisory only — it never writes to source files.** Given a broken selector, the failure
text and a DOM snapshot, it returns:

```json
{
  "healable": true,
  "originalSelector": "[data-test=\"login-buttoon\"]",
  "healedSelector": "[data-test=\"login-button\"]",
  "confidence": 0.95,
  "rationale": "…",
  "alternatives": ["…"]
}
```

`healedSelector` is optional so an honest `healable: false` still satisfies the schema.

The spec is the strongest of the four: it opens the real TTACart login page, proves the
selector is broken, asks for a heal, and then **applies the healed selector to the live
page** (`expect(page.locator(healed)).toBeVisible()`). A suggestion that doesn't actually
resolve fails the test.

Results are attached as `ai-heal` and rendered in the reporter's **🩹 Self-Healing** tab.

## Reporter wiring

`CustomReporter` previously carried commented-out imports for these modules, which made
`onEnd` throw (`ReferenceError: analyzeFlaky is not defined`) and left every run's report
half-generated — the final HTML was never rebuilt and `index.html` kept pointing at an old
run. Those imports now resolve, so `Report generated: …` prints and `index.html` updates.

The reporter also gained a **🩹 Self-Healing** tab. `switchMainTab` is generic, so only a
button, a panel and two render methods were needed.

## Running

```bash
# Everything AI
npx playwright test --project=ai --reporter=list

# One agent
npx playwright test src/tests/aiTests/rca-agent.spec.ts --project=ai --reporter=list
```

Without a configured provider, the four key-gated specs skip and the deterministic tests
(the flaky diff and the schema-sync check) still run — the suite exits 0.

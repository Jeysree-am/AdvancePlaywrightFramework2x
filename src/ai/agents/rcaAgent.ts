/**
 * rcaAgent — root-cause analysis for a failed test.
 *
 * Takes a failure (title, file, error, stack) and returns a triage verdict:
 * severity, priority, a concise root cause, and concrete fixes. The output
 * contract is `@testdata/schemas/rca-verdict.schema.json`, and it is exactly what
 * `CustomReporter`'s AI Verdict tab renders.
 *
 *     const verdict = await analyzeFailure({
 *         title: 'Checkout › completes order',
 *         file: 'src/tests/e2e/e2e-checkout.spec.ts:31',
 *         error: 'Error: locator.click: Timeout 15000ms exceeded...',
 *     });
 *
 * Low temperature on purpose: triage should be consistent run to run, not
 * creative.
 */

import type { Schema } from 'ajv';
import rcaVerdictSchema from '@testdata/schemas/rca-verdict.schema.json';
import { createAgent } from '@ai/agents/createAgent';

/** The reporter's `.sev-*` badge classes fix this set. */
export type RcaSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RcaVerdict {
    severity: RcaSeverity;
    priority: string;
    rootCause: string;
    fixes: string[];
}

export interface FailureInput {
    title: string;
    file: string;
    error: string;
    stack?: string;
}

export const RCA_PROMPT = [
    'You are a test-failure triage engineer for a Playwright + TypeScript suite.',
    '',
    'Given one failing test, decide the most likely root cause and how to fix it.',
    '',
    'Severity, for the suite (not the product roadmap):',
    '- critical: the suite cannot run, or a core user path is broken.',
    '- high: a real product or test bug on an important path.',
    '- medium: a test bug, brittleness, or a non-critical path.',
    '- low: cosmetic, environment noise, or an easily retried flake.',
    '',
    'Rules:',
    '- rootCause: 1-3 sentences naming the specific mechanism, not a restatement of the error.',
    '- fixes: 1-5 concrete, actionable steps (name the file, selector, wait or config to change).',
    '- Distinguish a product bug from a test bug from environment/flake, and say which it is.',
    '- priority: a short label such as P0, P1, P2 or P3.',
    '- Do not invent stack frames or files that were not provided.',
].join('\n');

export const rcaAgent = createAgent<RcaVerdict>({
    name: 'rca',
    systemPrompt: RCA_PROMPT,
    outputSchema: rcaVerdictSchema as Schema,
    temperature: 0.2,
});

/** Triage one failure. Throws if the provider is unconfigured or output is invalid. */
export async function analyzeFailure(input: FailureInput): Promise<RcaVerdict> {
    const brief = [
        `Test: ${input.title}`,
        `File: ${input.file}`,
        '',
        'Error:',
        input.error,
        ...(input.stack ? ['', 'Stack:', input.stack] : []),
    ].join('\n');

    return rcaAgent.run(brief);
}

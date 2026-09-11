/**
 * flakyAnalyzer — compares this build against the previous one.
 *
 * Two deliberately separate halves:
 *
 *   1. {@link diffBuilds} is **pure and deterministic** — no LLM, no network. It
 *      decides which tests are flaky by diffing statuses across builds. Flaky
 *      detection must never depend on a model being reachable or correct.
 *
 *   2. {@link analyzeFlaky} wraps that result and, only when a provider is
 *      available, asks the LLM to write the one-paragraph `summary` prose.
 *
 * The reporter writes `reports/runs/run-<id>.json` snapshots and calls
 * `analyzeFlaky(prev, curr, hasApiKey())`. Because it is called from the
 * reporter's `onEnd` with no surrounding try/catch, this function never throws:
 * a failed summary degrades to a result without prose.
 */

import type { Schema } from 'ajv';
import flakyAnalysisSchema from '@testdata/schemas/flaky-analysis.schema.json';
import { createLogger } from '@utils/logger';
import { createAgent } from '@ai/agents/createAgent';

const log = createLogger('flakyAnalyzer');

/** One run's per-test statuses, as snapshotted by `CustomReporter`. */
export interface BuildSummary {
    runId: string;
    tests: Record<string, string>;
}

export interface FlakyResult {
    counts: { flaky: number; failing: number; total: number };
    flaky: string[];
    summary?: string;
}

/** Statuses that mean the test reached a verdict (so a change is meaningful). */
const CONCLUSIVE = new Set(['passed', 'failed', 'timedOut']);
const FAILING = new Set(['failed', 'timedOut']);

/**
 * Deterministic build-vs-build diff.
 *
 * A test is flaky when it is present in both builds and its status *changed*
 * between two conclusive states — i.e. it both passed and failed. Transitions
 * involving `skipped` are not flakiness (a test can be legitimately skipped).
 */
export function diffBuilds(prev: BuildSummary, curr: BuildSummary): FlakyResult {
    const flaky: string[] = [];
    let failing = 0;

    for (const [title, currStatus] of Object.entries(curr.tests)) {
        if (FAILING.has(currStatus)) failing++;

        const prevStatus = prev.tests[title];
        if (!prevStatus || prevStatus === currStatus) continue;
        if (!CONCLUSIVE.has(prevStatus) || !CONCLUSIVE.has(currStatus)) continue;

        flaky.push(title);
    }

    return {
        counts: { flaky: flaky.length, failing, total: Object.keys(curr.tests).length },
        flaky,
    };
}

/** A one-paragraph, human-readable summary of the diff. */
const summaryAgent = createAgent<{ summary: string }>({
    name: 'flaky-summary',
    systemPrompt: [
        'You summarize flaky-test analysis for a Playwright suite in 2-3 sentences.',
        '',
        '- Name the tests that flipped between the two builds and the direction they flipped.',
        '- Say whether the failures look like flakes, real regressions, or environment noise.',
        '- Be concrete and brief. No preamble, no bullet lists.',
    ].join('\n'),
    outputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: { summary: { type: 'string', minLength: 1 } },
    } as Schema,
    temperature: 0.2,
});

/**
 * Full analysis: deterministic diff, plus an LLM summary when a key is present.
 * Never throws — the reporter calls this during `onEnd`.
 */
export async function analyzeFlaky(
    prev: BuildSummary,
    curr: BuildSummary,
    hasKey: boolean,
): Promise<FlakyResult> {
    const result = diffBuilds(prev, curr);

    if (!hasKey || !summaryAgent.isConfigured()) return result;

    try {
        const brief = [
            `Build ${prev.runId} -> ${curr.runId}`,
            `Flaky: ${result.flaky.length} of ${result.counts.total}`,
            `Failing in latest build: ${result.counts.failing}`,
            '',
            'Flaky tests:',
            ...(result.flaky.length ? result.flaky.map((t) => `- ${t}`) : ['(none)']),
        ].join('\n');

        const { summary } = await summaryAgent.run(brief);
        return { ...result, summary };
    } catch (error) {
        log.warn(`summary skipped: ${(error as Error).message}`);
        return result;
    }
}

/** Validates against the FlakyResult contract. Used by the spec. */
export const flakyAnalysisJsonSchema = flakyAnalysisSchema as Schema;

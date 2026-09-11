/**
 * Flaky analyzer — build-vs-build comparison.
 *
 * Two halves, deliberately separate:
 *
 *  1. `diffBuilds` is deterministic and offline. This is the real product logic
 *     (which tests flipped between builds) and it must pass without a provider or
 *     network, so it is asserted unconditionally below.
 *
 *  2. `analyzeFlaky` adds the LLM-written summary. Key-gated.
 */

import { test, expect } from '@playwright/test';
import type { Schema } from 'ajv';
import { SchemaValidator } from '@utils/SchemaValidator';
import {
    analyzeFlaky,
    diffBuilds,
    flakyAnalysisJsonSchema,
    type BuildSummary,
} from '@ai/agents/flakyAnalyzer';
import { hasApiKey } from '@ai/config/providers';

const validator = new SchemaValidator();
const schema = flakyAnalysisJsonSchema as Schema;

const build = (runId: string, tests: Record<string, string>): BuildSummary => ({ runId, tests });

test.describe('Flaky analyzer — deterministic diff', () => {
    test('flags a test that flipped from passed to failed', () => {
        const result = diffBuilds(
            build('run-1', { 'a › passes': 'passed', 'b › flips': 'passed' }),
            build('run-2', { 'a › passes': 'passed', 'b › flips': 'failed' }),
        );

        expect(result.flaky).toEqual(['b › flips']);
        expect(result.counts).toEqual({ flaky: 1, failing: 1, total: 2 });
    });

    test('flags a test that flipped from failed to passed', () => {
        const result = diffBuilds(
            build('run-1', { 'b › flips': 'failed' }),
            build('run-2', { 'b › flips': 'passed' }),
        );

        expect(result.flaky).toEqual(['b › flips']);
        expect(result.counts).toEqual({ flaky: 1, failing: 0, total: 1 });
    });

    test('does not flag stable results', () => {
        const result = diffBuilds(
            build('run-1', { 'a › passes': 'passed', 'b › fails': 'failed' }),
            build('run-2', { 'a › passes': 'passed', 'b › fails': 'failed' }),
        );

        expect(result.flaky).toEqual([]);
        expect(result.counts).toEqual({ flaky: 0, failing: 1, total: 2 });
    });

    test('does not treat skipped transitions as flakiness', () => {
        const result = diffBuilds(
            build('run-1', { 'a › skipped then run': 'skipped', 'b › run then skipped': 'passed' }),
            build('run-2', { 'a › skipped then run': 'passed', 'b › run then skipped': 'skipped' }),
        );

        expect(result.flaky).toEqual([]);
        expect(result.counts).toEqual({ flaky: 0, failing: 0, total: 2 });
    });

    test('ignores tests that only exist in the newer build', () => {
        const result = diffBuilds(
            build('run-1', {}),
            build('run-2', { 'brand › new test': 'passed' }),
        );

        expect(result.flaky).toEqual([]);
        expect(result.counts.total).toBe(1);
    });

    test('treats timedOut as a failure', () => {
        const result = diffBuilds(
            build('run-1', { 'c › slow': 'passed' }),
            build('run-2', { 'c › slow': 'timedOut' }),
        );

        expect(result.flaky).toEqual(['c › slow']);
        expect(result.counts.failing).toBe(1);
    });

    test('its output satisfies the FlakyResult contract without any key', () => {
        const result = diffBuilds(
            build('run-1', { 'a › flip': 'passed' }),
            build('run-2', { 'a › flip': 'failed' }),
        );

        const validation = validator.validate(result, schema, 'flaky-result.diff');
        expect(validation.valid, validation.errorText).toBe(true);
    });
});

test.describe('Flaky analyzer — AI summary', () => {
    test('adds an LLM summary and still satisfies the contract', async () => {
        test.skip(!hasApiKey(), 'No LLM provider configured (set LLM_PROVIDER + key)');

        const prev = build('run-1', { 'a › passes': 'passed', 'b › flips': 'passed', 'c › fails': 'failed' });
        const curr = build('run-2', { 'a › passes': 'passed', 'b › flips': 'failed', 'c › fails': 'failed' });

        const result = await analyzeFlaky(prev, curr, true);

        expect(result.counts.flaky).toBe(1);
        expect(result.summary).toBeTruthy();

        const validation = validator.validate(result, schema, 'flaky-result.ai');
        expect(validation.valid, validation.errorText).toBe(true);
    });

    test('returns the deterministic result unchanged when no key is available', async () => {
        const prev = build('run-1', { 'a › flips': 'passed' });
        const curr = build('run-2', { 'a › flips': 'failed' });

        const result = await analyzeFlaky(prev, curr, false);

        expect(result.summary).toBeUndefined();
        expect(result.flaky).toEqual(['a › flips']);
    });
});

/**
 * RCA agent — triages a failed test into a root-cause verdict.
 *
 * Feeds the agent a realistic Playwright failure and asserts the verdict holds
 * the contract `CustomReporter`'s AI Verdict tab renders
 * (`rca-verdict.schema.json`).
 *
 * The reporter calls the same `analyzeFailure` automatically during `onEnd` for
 * every failed test, so this spec exercises that path directly.
 */

import { test, expect } from '@playwright/test';
import type { Schema } from 'ajv';
import { SchemaValidator } from '@utils/SchemaValidator';
import { analyzeFailure, rcaAgent } from '@ai/agents/rcaAgent';
import rcaVerdictSchema from '@testdata/schemas/rca-verdict.schema.json';

const validator = new SchemaValidator();
const schema = rcaVerdictSchema as Schema;

const TIMEOUT_FAILURE = {
    title: 'E2E @Checkout Checkout Feature › should complete checkout successfully',
    file: 'src/tests/e2e/e2e-checkout.spec.ts:31',
    error: [
        'Error: locator.click: Timeout 15000ms exceeded.',
        'Call log:',
        '  - waiting for locator(\'[data-test="checkout"]\')',
        '    - locator resolved to <button disabled type="submit" data-test="checkout">Checkout</button>',
        '    - attempting click action',
    ].join('\n'),
    stack: [
        '    at CheckoutStepOnePage.finish (src/pages/CheckoutStepOnePage.ts:42:28)',
        '    at src/tests/e2e/e2e-checkout.spec.ts:44:9',
    ].join('\n'),
};

test.describe('RCA agent', () => {
    test.skip(!rcaAgent.isConfigured(), 'No LLM provider configured (set LLM_PROVIDER + key)');

    test('returns a contract-valid verdict for a locator timeout', async () => {
        const verdict = await analyzeFailure(TIMEOUT_FAILURE);

        const result = validator.validate(verdict, schema, 'rca-verdict.spec');
        expect(result.valid, result.errorText).toBe(true);

        expect(['critical', 'high', 'medium', 'low']).toContain(verdict.severity);
        expect(verdict.priority.length).toBeGreaterThan(0);
        expect(verdict.rootCause.length).toBeGreaterThan(0);
        expect(verdict.fixes.length).toBeGreaterThan(0);
    });
});

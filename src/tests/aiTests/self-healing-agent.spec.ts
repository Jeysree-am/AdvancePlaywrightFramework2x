/**
 * Self-healing agent — proposes a corrected locator for a broken selector.
 *
 * This is the strongest of the agent specs: it does not stop at "the model
 * returned valid JSON". It opens the real TTACart login page, breaks a known
 * selector, asks the agent to heal it, and then **applies the healed selector to
 * the live page**. A suggestion that doesn't actually resolve fails the test.
 *
 * Advisory only — the agent never writes to source files.
 */

import { test, expect } from '@playwright/test';
import type { Schema } from 'ajv';
import { SchemaValidator } from '@utils/SchemaValidator';
import { suggestHealing, selfHealingAgent } from '@ai/agents/selfHealingAgent';
import { LoginPage } from '@pages/LoginPage';
import selfHealingSchema from '@testdata/schemas/self-healing.schema.json';

const validator = new SchemaValidator();
const schema = selfHealingSchema as Schema;

// The `ai` project points baseURL at the API host, so navigate the UI explicitly.
const UI_BASE_URL = process.env.QA_BASE_URL || 'https://app.thetestingacademy.com';

const BROKEN = '[data-test="login-buttoon"]'; // typo: missing "n"
const INTENDED = '[data-test="login-button"]';

test.describe('Self-healing agent', () => {
    test.skip(!selfHealingAgent.isConfigured(), 'No LLM provider configured (set LLM_PROVIDER + key)');

    test('heals a mistyped login selector and the healed locator works on the page', async ({
        page,
    }, testInfo) => {
        await page.goto(`${UI_BASE_URL}${LoginPage.PATH}`);

        // Show the selector really is broken, and that the element does exist.
        await expect(page.locator(BROKEN)).toHaveCount(0);
        await expect(page.locator(INTENDED)).toBeVisible();

        // The login form is the region the selector was written for. Reading it
        // through Playwright (rather than DOM globals) keeps this spec compilable
        // under the project's ES-only `lib` setting.
        const formCount = await page.locator('form').count();
        // eslint-disable-next-line playwright/no-conditional-in-test -- fall back to <body> when the page has no form
        const region = formCount > 0 ? page.locator('form').first() : page.locator('body');
        const domSnapshot = (await region.innerHTML()).slice(0, 12000);

        const suggestion = await suggestHealing({
            selector: BROKEN,
            error: `Error: locator.click: Timeout 15000ms exceeded.\nwaiting for locator('${BROKEN}')`,
            domSnapshot,
            testTitle: 'TTACART login',
        });

        const result = validator.validate(suggestion, schema, 'self-healing.spec');
        expect(result.valid, result.errorText).toBe(true);
        expect(suggestion.healable).toBe(true);
        expect(suggestion.confidence).toBeGreaterThan(0);
        expect(suggestion.healedSelector).toBeTruthy();

        // The point of the whole exercise: the proposal must actually resolve.
        await expect(page.locator(suggestion.healedSelector as string)).toBeVisible();

        await testInfo.attach('ai-heal', {
            body: JSON.stringify(suggestion),
            contentType: 'application/json',
        });
    });
});

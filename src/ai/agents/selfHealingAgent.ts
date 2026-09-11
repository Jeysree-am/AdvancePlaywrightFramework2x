/**
 * selfHealingAgent — proposes a corrected locator for a broken Playwright selector.
 *
 * Advisory only: it returns a suggestion, and nothing here (or anywhere else)
 * writes to source files. The framework author decides what to apply.
 *
 *     const suggestion = await suggestHealing({
 *         selector: '[data-test="login-buttoon"]',
 *         error: 'locator.click: Timeout 15000ms exceeded',
 *         domSnapshot: await page.locator('form').innerHTML(),
 *     });
 *     // suggestion.healedSelector -> '[data-test="login-button"]'
 *
 * The output contract is `@testdata/schemas/self-healing.schema.json`.
 */

import type { Schema } from 'ajv';
import selfHealingSchema from '@testdata/schemas/self-healing.schema.json';
import { createAgent } from '@ai/agents/createAgent';

export interface HealingInput {
    /** The selector that failed. */
    selector: string;
    /** The Playwright failure text. */
    error: string;
    /** HTML around the intended element — the DOM the selector must match. */
    domSnapshot: string;
    /** Optional test title, for context in the rationale. */
    testTitle?: string;
}

export interface SelfHealingSuggestion {
    healable: boolean;
    originalSelector: string;
    /** Absent when `healable` is false. */
    healedSelector?: string;
    /** 0..1 */
    confidence: number;
    rationale: string;
    alternatives?: string[];
}

export const SELF_HEALING_PROMPT = [
    'You repair broken Playwright locators.',
    '',
    'You are given a selector that failed, the failure text, and a DOM snapshot of the',
    'region it was meant to target. Propose ONE replacement selector that matches the same',
    'element the original was clearly written for.',
    '',
    'Rules:',
    '- Prefer stable hooks: [data-test="..."], role + name, label, placeholder, then text.',
    '- Avoid brittle positional CSS (nth-child, long class chains) unless nothing else works.',
    '- healedSelector must be a valid Playwright selector string, and must appear to match an',
    '  element present in the DOM snapshot.',
    '- confidence: 0..1, honest. Below 0.5 if you are guessing.',
    '- rationale: 1-2 sentences on why the original broke and why your selector is better.',
    '- alternatives: up to 3 other acceptable selectors, best first.',
    '- If the DOM snapshot shows the intended element genuinely does not exist, set',
    '  healable=false, omit healedSelector, and explain what is missing in the rationale.',
].join('\n');

export const selfHealingAgent = createAgent<SelfHealingSuggestion>({
    name: 'self-healing',
    systemPrompt: SELF_HEALING_PROMPT,
    outputSchema: selfHealingSchema as Schema,
    temperature: 0.2,
});

/** Suggest a healed locator. Throws if the provider is unconfigured or output is invalid. */
export async function suggestHealing(input: HealingInput): Promise<SelfHealingSuggestion> {
    const brief = [
        ...(input.testTitle ? [`Test: ${input.testTitle}`, ''] : []),
        `Broken selector: ${input.selector}`,
        '',
        'Failure:',
        input.error,
        '',
        'DOM snapshot:',
        input.domSnapshot,
    ].join('\n');

    return selfHealingAgent.run(brief);
}

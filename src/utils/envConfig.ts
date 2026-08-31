/**
 * envConfig — typed accessors for environment-driven test data.
 *
 * dotenv is loaded centrally in playwright.config.ts, so any spec, fixture,
 * or util can read process.env at import time. This module centralises those
 * reads so specs stay declarative and the fail-fast behaviour lives in one
 * place.
 *
 * Note: we deliberately use TTACart-specific keys (STANDARD_USER / TTA_SECRET)
 * rather than generic USERNAME / PASSWORD — Windows sets USERNAME to the
 * logged-in user by default, and dotenv never overrides vars that already
 * exist in the environment.
 */

import type { Credentials } from '@utils/DataGenerator';

/** Read a var, trim it, and treat empty/whitespace as "not set". */
function env(key: string): string | undefined {
    const value = process.env[key];
    return value && value.trim() !== '' ? value.trim() : undefined;
}

/** Required credentials — throws a clear message before any browser starts. */
export function getCredentials(): Credentials {
    const username = env('STANDARD_USER');
    const password = env('TTA_SECRET');
    if (!username || !password) {
        throw new Error(
            'Missing credentials for e2e-checkout-env. ' +
            'Set STANDARD_USER and TTA_SECRET in the .env file (see .env.example).',
        );
    }
    return { username, password };
}

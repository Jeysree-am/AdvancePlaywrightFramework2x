/**
 * providers — the provider registry for the AI layer.
 *
 * Adding a provider means one entry in {@link PROVIDERS}: a base URL, the env
 * vars its key may live in, a default model and the wire it speaks. No client
 * or agent code changes.
 *
 * Environment:
 *   LLM_PROVIDER         active provider id (default 'commandcode')
 *   LLM_MODEL            override the provider's default model
 *   LLM_BASE_URL         override the provider's base URL
 *   LLM_API_KEY          override the provider's key
 *   LLM_WIRE             override the wire ('openai-completions' | 'anthropic-messages')
 *
 * The `commandcode` provider targets the Command Code Provider API and reads its
 * key from the existing `command_api_key`; set COMMAND_CODE_BASE_URL only to
 * point somewhere else. A provider with no key is simply treated as
 * unconfigured, so a keyless checkout still passes.
 */

import { createLogger } from '@utils/logger';
import type { LLMProvider, LLMWire, ResolvedProvider } from '@ai/client/types';

export type { LLMProvider } from '@ai/client/types';

export interface ProviderDef {
    label: string;
    wire: LLMWire;
    /** Empty when the base URL must come from the environment (see `commandcode`). */
    baseURL: string;
    /** Env vars to read the key from; the first non-empty one wins. */
    apiKeyEnv: string[];
    defaultModel: string;
}

export const PROVIDERS: Record<LLMProvider, ProviderDef> = {
    deepseek: {
        label: 'DeepSeek',
        wire: 'openai-completions',
        baseURL: 'https://api.deepseek.com/v1',
        apiKeyEnv: ['DEEPSEEK_API_KEY'],
        defaultModel: 'deepseek-chat',
    },
    openrouter: {
        label: 'OpenRouter',
        wire: 'openai-completions',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKeyEnv: ['OPENROUTER_API_KEY'],
        defaultModel: 'deepseek/deepseek-chat',
    },
    groq: {
        label: 'Groq',
        wire: 'openai-completions',
        baseURL: 'https://api.groq.com/openai/v1',
        apiKeyEnv: ['GROQ_API_KEY'],
        // Groq rotates its catalog; this is what its /models endpoint serves
        // today. Override with LLM_MODEL if your account differs.
        defaultModel: 'openai/gpt-oss-120b',
    },
    commandcode: {
        label: 'Command Code',
        wire: 'openai-completions',
        // Command Code Provider API. The OpenAI wire lives at
        // `{baseURL}/v1/chat/completions` and the Anthropic wire at
        // `{baseURL}/v1/messages`, so both wires work off this one root.
        baseURL: 'https://api.commandcode.ai/provider/v1',
        apiKeyEnv: ['command_api_key', 'COMMAND_API_KEY'],
        defaultModel: 'deepseek/deepseek-v4-flash',
    },
};

const log = createLogger('providers');

const WIRES: LLMWire[] = ['openai-completions', 'anthropic-messages'];

function env(key: string): string | undefined {
    const value = process.env[key];
    return value && value.trim() !== '' ? value.trim() : undefined;
}

function firstEnv(keys: string[]): string | undefined {
    for (const key of keys) {
        const value = env(key);
        if (value) return value;
    }
    return undefined;
}

function isKnownProvider(id: string): id is LLMProvider {
    return Object.prototype.hasOwnProperty.call(PROVIDERS, id);
}

function asWire(value: string | undefined): LLMWire | undefined {
    if (!value) return undefined;
    if (!WIRES.includes(value as LLMWire)) {
        log.warn(`ignoring LLM_WIRE="${value}" — expected one of ${WIRES.join(', ')}`);
        return undefined;
    }
    return value as LLMWire;
}

export interface ProviderOverrides {
    provider?: string;
    wire?: LLMWire;
    baseURL?: string;
    apiKey?: string;
    model?: string;
}

/**
 * Resolve the active provider: explicit overrides win over env vars, which win
 * over the registry defaults.
 */
export function resolveProvider(overrides: ProviderOverrides = {}): ResolvedProvider {
    const requested = overrides.provider ?? env('LLM_PROVIDER') ?? 'commandcode';
    if (!isKnownProvider(requested)) {
        throw new Error(
            `[providers] unknown provider "${requested}" — known providers: ${Object.keys(PROVIDERS).join(', ')}`,
        );
    }

    const def = PROVIDERS[requested];
    const envBaseURL = requested === 'commandcode' ? env('COMMAND_CODE_BASE_URL') : undefined;

    return {
        id: requested,
        label: def.label,
        wire: overrides.wire ?? asWire(env('LLM_WIRE')) ?? def.wire,
        baseURL: overrides.baseURL ?? env('LLM_BASE_URL') ?? envBaseURL ?? def.baseURL,
        apiKey: overrides.apiKey ?? env('LLM_API_KEY') ?? firstEnv(def.apiKeyEnv),
        model: overrides.model ?? env('LLM_MODEL') ?? def.defaultModel,
    };
}

/**
 * True when a call can actually be made: the provider needs both an endpoint and
 * a key. Never throws — an unknown or half-configured provider is simply "no".
 * This is the guard the reporter and the AI specs use to stay green offline.
 */
export function hasApiKey(provider?: string): boolean {
    try {
        const resolved = resolveProvider(provider ? { provider } : {});
        return Boolean(resolved.baseURL && resolved.apiKey);
    } catch {
        return false;
    }
}

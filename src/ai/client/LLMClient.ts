/**
 * LLMClient — one provider-agnostic entry point for chat completions.
 *
 * The client resolves a provider (see {@link resolveProvider}), picks the wire
 * adapter for it, and makes a plain HTTP request with the built-in `fetch`.
 * There are no vendor SDKs: swapping DeepSeek for Groq is an `.env` change
 * (`LLM_PROVIDER`), not a code change.
 *
 *     const client = new LLMClient();                 // from the environment
 *     if (client.isConfigured()) {
 *         const { text } = await client.chat([{ role: 'user', content: 'hi' }]);
 *     }
 *
 * The client never validates output and never knows about JSON schemas — that is
 * the agent factory's job (`@ai/agents/createAgent`).
 */

import { createLogger } from '@utils/logger';
import { getAdapter } from '@ai/client/adapters';
import { resolveProvider } from '@ai/config/providers';
import type {
    ChatOptions,
    LLMMessage,
    LLMProvider,
    LLMResponse,
    LLMWire,
    ResolvedProvider,
} from '@ai/client/types';

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_TOKENS = 1024;

export interface LLMClientOptions {
    /** Provider id. Defaults to `LLM_PROVIDER`, else `commandcode`. */
    provider?: LLMProvider | string;
    /** Wire format. Defaults to the provider's declared wire. */
    wire?: LLMWire;
    /** Override the provider's base URL (else `LLM_BASE_URL`, else the registry). */
    baseURL?: string;
    /** Override the API key (else `LLM_API_KEY`, else the provider's env vars). */
    apiKey?: string;
    /** Override the model id (else `LLM_MODEL`, else the provider's default). */
    model?: string;
    /** Default sampling temperature for every call. */
    temperature?: number;
    /** Default output token cap. Default 1024. */
    maxTokens?: number;
    /** Per-request timeout. Default 60s. */
    timeoutMs?: number;
    /** Injectable transport for tests. Defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
}

export class LLMError extends Error {
    readonly provider: string;
    readonly status?: number;

    constructor(message: string, provider: string, status?: number) {
        super(message);
        this.name = 'LLMError';
        this.provider = provider;
        this.status = status;
    }
}

export class LLMClient {
    private readonly resolved: ResolvedProvider;
    private readonly defaultTemperature?: number;
    private readonly defaultMaxTokens: number;
    private readonly timeoutMs: number;
    private readonly fetchImpl: typeof fetch;
    private readonly log = createLogger('LLMClient');

    constructor(options: LLMClientOptions = {}) {
        this.resolved = resolveProvider({
            provider: options.provider,
            wire: options.wire,
            baseURL: options.baseURL,
            apiKey: options.apiKey,
            model: options.model,
        });
        this.defaultTemperature = options.temperature;
        this.defaultMaxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    get provider(): LLMProvider {
        return this.resolved.id;
    }

    get model(): string {
        return this.resolved.model;
    }

    get wire(): LLMWire {
        return this.resolved.wire;
    }

    /** True when the resolved provider has both a base URL and a key. */
    isConfigured(): boolean {
        return Boolean(this.resolved.baseURL && this.resolved.apiKey);
    }

    /** Send a chat request and return the assistant text plus metadata. */
    async chat(messages: LLMMessage[], options: ChatOptions = {}): Promise<LLMResponse> {
        if (!this.isConfigured()) {
            throw new LLMError(
                `[LLMClient] provider "${this.resolved.id}" is not configured — set its API key (and COMMAND_CODE_BASE_URL for the commandcode provider)`,
                this.resolved.id,
            );
        }

        const merged: ChatOptions = {
            temperature: options.temperature ?? this.defaultTemperature,
            maxTokens: options.maxTokens ?? this.defaultMaxTokens,
            json: options.json,
        };

        const adapter = getAdapter(this.resolved.wire);
        const { url, init } = adapter.buildRequest({
            provider: this.resolved,
            messages,
            options: merged,
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
            response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        } catch (error) {
            const reason =
                (error as Error).name === 'AbortError'
                    ? `timed out after ${this.timeoutMs}ms`
                    : (error as Error).message;
            throw new LLMError(
                `[LLMClient] ${this.resolved.id} request failed: ${reason}`,
                this.resolved.id,
            );
        } finally {
            clearTimeout(timer);
        }

        const raw = await response.text();
        if (!response.ok) {
            throw new LLMError(
                `[LLMClient] ${this.resolved.id} ${response.status}: ${raw.slice(0, 500)}`,
                this.resolved.id,
                response.status,
            );
        }

        let body: unknown;
        try {
            body = JSON.parse(raw);
        } catch {
            throw new LLMError(
                `[LLMClient] ${this.resolved.id} returned a non-JSON response: ${raw.slice(0, 200)}`,
                this.resolved.id,
                response.status,
            );
        }

        const { text, usage } = adapter.parseResponse(body);
        this.log.debug(`${this.resolved.id}/${this.resolved.model} -> ${text.length} chars`);

        return { text, model: this.resolved.model, provider: this.resolved.id, usage };
    }
}

/**
 * types — the shared vocabulary of the AI layer.
 *
 * These types are deliberately provider-neutral: nothing here mentions OpenAI,
 * Anthropic, DeepSeek or any vendor. A provider is described by a base URL, a
 * key, a wire format and a model id, so adding one is a registry entry (see
 * `@ai/config/providers`), never a new code path.
 */

/** Supported providers. Add an id here and a matching entry in `PROVIDERS`. */
export type LLMProvider = 'deepseek' | 'openrouter' | 'groq' | 'commandcode';

/**
 * The request/response shape a provider speaks.
 * - `openai-completions` -> POST /chat/completions
 * - `anthropic-messages` -> POST /v1/messages
 */
export type LLMWire = 'openai-completions' | 'anthropic-messages';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    /** Sampling temperature. */
    temperature?: number;
    /** Upper bound on generated tokens. */
    maxTokens?: number;
    /** Ask the provider for a JSON object response where the wire supports it. */
    json?: boolean;
}

export interface LLMUsage {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
}

export interface LLMResponse {
    text: string;
    model: string;
    provider: LLMProvider;
    usage?: LLMUsage;
}

/** A provider definition resolved against the environment. */
export interface ResolvedProvider {
    id: LLMProvider;
    label: string;
    wire: LLMWire;
    baseURL: string;
    apiKey?: string;
    model: string;
}

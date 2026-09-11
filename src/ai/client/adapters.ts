/**
 * adapters — one thin translator per wire format.
 *
 * A {@link WireAdapter} knows two things: how to turn a neutral chat request into
 * a concrete HTTP call, and how to pull the text (plus usage) back out of the
 * provider's response envelope. Everything above this file is wire-agnostic.
 */

import type { ChatOptions, LLMMessage, LLMUsage, LLMWire, ResolvedProvider } from '@ai/client/types';

export interface WireAdapter {
    buildRequest(input: {
        provider: ResolvedProvider;
        messages: LLMMessage[];
        options: ChatOptions;
    }): { url: string; init: RequestInit };
    parseResponse(body: unknown): { text: string; usage?: LLMUsage };
}

/**
 * Build an endpoint from a base URL and a fixed wire path.
 *
 * Base URLs are written both ways in the wild — `https://api.deepseek.com/v1`
 * and `https://api.commandcode.ai/provider/v1` include the version segment,
 * while `https://openrouter.ai/api` does not. Since every wire path below is
 * absolute (`/v1/...`), a trailing `/v1` is dropped first so it is never
 * doubled.
 */
function endpoint(baseURL: string, path: string): string {
    return `${baseURL.replace(/\/+$/, '').replace(/\/v1$/, '')}${path}`;
}

interface OpenAIUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

function openAIUsage(usage: OpenAIUsage | undefined): LLMUsage | undefined {
    if (!usage) return undefined;
    return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
    };
}

/** OpenAI-compatible: DeepSeek, OpenRouter, Groq, Ollama, vLLM, LM Studio, ... */
export const openAICompletionsAdapter: WireAdapter = {
    buildRequest({ provider, messages, options }) {
        const body: Record<string, unknown> = {
            model: provider.model,
            messages,
        };
        if (options.temperature !== undefined) body.temperature = options.temperature;
        if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
        if (options.json) body.response_format = { type: 'json_object' };

        return {
            url: endpoint(provider.baseURL, '/v1/chat/completions'),
            init: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
                },
                body: JSON.stringify(body),
            },
        };
    },
    parseResponse(body) {
        const data = body as {
            choices?: { message?: { content?: string | null } }[];
            usage?: OpenAIUsage;
        };
        return {
            text: data.choices?.[0]?.message?.content ?? '',
            usage: openAIUsage(data.usage),
        };
    },
};

/** Anthropic Messages API (`/v1/messages`). */
export const anthropicMessagesAdapter: WireAdapter = {
    buildRequest({ provider, messages, options }) {
        const system = messages
            .filter((message) => message.role === 'system')
            .map((message) => message.content)
            .join('\n\n');

        const turns = messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({ role: message.role, content: message.content }));

        const body: Record<string, unknown> = {
            model: provider.model,
            max_tokens: options.maxTokens ?? 1024,
            messages: turns,
        };
        if (system) body.system = system;
        if (options.temperature !== undefined) body.temperature = options.temperature;

        return {
            url: endpoint(provider.baseURL, '/v1/messages'),
            init: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    ...(provider.apiKey ? { 'x-api-key': provider.apiKey } : {}),
                },
                body: JSON.stringify(body),
            },
        };
    },
    parseResponse(body) {
        const data = body as {
            content?: { type?: string; text?: string }[];
            usage?: { input_tokens?: number; output_tokens?: number };
        };
        const text = (data.content ?? [])
            .filter((block) => block.text)
            .map((block) => block.text ?? '')
            .join('');

        const usage: LLMUsage | undefined = data.usage
            ? {
                  promptTokens: data.usage.input_tokens,
                  completionTokens: data.usage.output_tokens,
              }
            : undefined;

        return { text, usage };
    },
};

export function getAdapter(wire: LLMWire): WireAdapter {
    switch (wire) {
        case 'openai-completions':
            return openAICompletionsAdapter;
        case 'anthropic-messages':
            return anthropicMessagesAdapter;
        default:
            throw new Error(`[adapters] unsupported wire "${wire as string}"`);
    }
}

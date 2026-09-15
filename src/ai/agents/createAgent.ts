/**
 * createAgent — the agent factory.
 *
 * An agent is a system prompt plus an output schema. `createAgent` supplies all
 * the plumbing: it asks the model for JSON, parses it, validates it with the
 * shared {@link SchemaValidator}, and — if the model got it wrong — sends the
 * Ajv errors back for one repair round before giving up.
 *
 *     const agent = createAgent<Booking>({
 *         name: 'booking-test-data',
 *         systemPrompt: '…',
 *         outputSchema: bookingSchema,
 *     });
 *     const booking = await agent.run('a 3-night stay, breakfast included');
 *
 * Adding the next agent is a new file with a prompt and a schema — nothing else.
 */

import type { Schema } from 'ajv';
import { createLogger } from '@utils/logger';
import { SchemaValidator } from '@utils/SchemaValidator';
import { LLMClient } from '@ai/client/LLMClient';
import type { LLMMessage, LLMProvider } from '@ai/client/types';

export interface AgentDefinition {
    /** Identifies the agent in logs and schema-cache keys. */
    name: string;
    /** The agent's instructions. The output contract is appended automatically. */
    systemPrompt: string;
    /** Ajv schema the model's JSON output must satisfy. */
    outputSchema: Schema;
    /** Reuse a client (e.g. a specific provider). Defaults to one from the env. */
    client?: LLMClient;
    /** Sampling temperature forwarded to the model. */
    temperature?: number;
    /** Repair rounds after an invalid reply. Default 1. */
    maxRepairAttempts?: number;
}

export interface Agent<T> {
    readonly name: string;
    readonly provider: LLMProvider;
    readonly model: string;
    readonly outputSchema: Schema;
    /** True when the underlying client can make a call. */
    isConfigured(): boolean;
    /** Run the agent and return schema-validated output. */
    run(input: string): Promise<T>;
}

export class AgentNotConfiguredError extends Error {
    constructor(name: string) {
        super(
            `[agent:${name}] no LLM provider is configured — set LLM_PROVIDER and its API key (see .env.example)`,
        );
        this.name = 'AgentNotConfiguredError';
    }
}

export class AgentOutputError extends Error {
    readonly raw: string;
    readonly errorText: string;

    constructor(name: string, raw: string, errorText: string) {
        super(`[agent:${name}] model output did not satisfy the schema:\n${errorText}`);
        this.name = 'AgentOutputError';
        this.raw = raw;
        this.errorText = errorText;
    }
}

const validator = new SchemaValidator();
const DEFAULT_MAX_REPAIR_ATTEMPTS = 1;

/**
 * Pull the JSON object out of a model reply. Models often wrap it in a ```json
 * fence or add a sentence either side, so fall back to the outermost braces.
 */
function extractJson(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced ? fenced[1] : text).trim();
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

export function createAgent<T>(def: AgentDefinition): Agent<T> {
    // Built on first use, not at import. Agents are created at module scope and
    // imported by CustomReporter, so resolving the provider has to stay lazy:
    // a misconfigured environment must not crash the reporter at load time.
    let cachedClient: LLMClient | undefined;
    const getClient = (): LLMClient =>
        (cachedClient ??= def.client ?? new LLMClient({ temperature: def.temperature }));

    const schema = def.outputSchema;
    const maxRepairs = def.maxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS;
    const cacheKey = `agent:${def.name}:output`;
    const log = createLogger(`agent:${def.name}`);

    const instructions = [
        def.systemPrompt,
        '',
        'Reply with a single JSON object and nothing else. It must satisfy this JSON schema:',
        JSON.stringify(schema, null, 2),
    ].join('\n');

    return {
        name: def.name,
        get provider(): LLMProvider {
            return getClient().provider;
        },
        get model(): string {
            return getClient().model;
        },
        outputSchema: schema,
        // Never throws: an unresolvable provider simply "isn't configured", which
        // is what callers (and the reporter's hasApiKey guard) test for.
        isConfigured: () => {
            try {
                return getClient().isConfigured();
            } catch {
                return false;
            }
        },

        async run(input: string): Promise<T> {
            const client = getClient();
            if (!client.isConfigured()) throw new AgentNotConfiguredError(def.name);

            const messages: LLMMessage[] = [
                { role: 'system', content: instructions },
                { role: 'user', content: input },
            ];

            let lastRaw = '';
            let lastErrorText = '';

            for (let attempt = 0; attempt <= maxRepairs; attempt++) {
                const response = await client.chat(messages, { json: true });
                lastRaw = response.text;

                let parsed: unknown;
                try {
                    parsed = JSON.parse(extractJson(response.text));
                } catch (error) {
                    lastErrorText = `response was not valid JSON: ${(error as Error).message}`;
                    log.warn(`attempt ${attempt + 1}: ${lastErrorText}`);
                    messages.push({ role: 'assistant', content: response.text });
                    messages.push({
                        role: 'user',
                        content: `That was not valid JSON (${lastErrorText}). Reply with the JSON object only.`,
                    });
                    continue;
                }

                const result = validator.validate(parsed, schema, cacheKey);
                if (result.valid) {
                    if (attempt > 0) log.info(`repaired invalid output on attempt ${attempt + 1}`);
                    return parsed as T;
                }

                lastErrorText = result.errorText;
                log.warn(`attempt ${attempt + 1}: output failed schema validation`);
                messages.push({ role: 'assistant', content: response.text });
                messages.push({
                    role: 'user',
                    content: `That JSON did not satisfy the schema:\n${result.errorText}\nReply with corrected JSON only.`,
                });
            }

            throw new AgentOutputError(def.name, lastRaw, lastErrorText);
        },
    };
}

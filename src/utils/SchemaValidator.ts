/**
 * SchemaValidator — a thin, reusable Ajv wrapper for JSON Schema validation.
 *
 * One Ajv instance (with the standard `format` keywords registered) is shared by
 * every validator built here, and compiled validators are cached, so a schema is
 * compiled once no matter how many times a spec validates against it.
 *
 * Typical use in a spec:
 *
 *   const validator = new SchemaValidator();
 *   const result = validator.validate(response, createBookingSchema);
 *   expect(result.valid, result.errorText).toBe(true);
 *
 * Use `assertValid` when a mismatch should fail fast with a readable message.
 *
 * Ajv runs with `strict: false` by default: schemas may carry keywords such as
 * `$schema`/`title` that Ajv would otherwise flag as unknown, and a validation
 * failure should surface as a failed assertion, not a compile-time throw.
 */

import Ajv, { type ErrorObject, type Schema, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { createLogger } from '@utils/logger';

const log = createLogger('SchemaValidator');

export interface ValidationResult {
    valid: boolean;
    errors: ErrorObject[];
    errorText: string;
}

export interface SchemaValidatorOptions {
    /** Collect every error instead of stopping at the first. Default true. */
    allErrors?: boolean;
    /** Ajv strict mode. Default false so optional keywords are tolerated. */
    strict?: boolean;
    /** Cache only. When false, every `compile` builds a fresh validator. */
    cache?: boolean;
}

export class ValidationError extends Error {
    readonly errors: ErrorObject[];
    readonly errorText: string;

    constructor(message: string, errors: ErrorObject[], errorText: string) {
        super(message);
        this.name = 'ValidationError';
        this.errors = errors;
        this.errorText = errorText;
    }
}

export class SchemaValidator {
    private readonly ajv: Ajv;
    private readonly cacheEnabled: boolean;
    private readonly cache = new Map<string, ValidateFunction>();

    constructor(options: SchemaValidatorOptions = {}) {
        const { cache = true, ...ajvOptions } = options;
        this.cacheEnabled = cache;
        this.ajv = new Ajv({ allErrors: true, strict: false, ...ajvOptions });
        addFormats(this.ajv);
    }

    /** Compile (and cache) a schema. `cacheKey` avoids recompiling on every call. */
    compile(schema: Schema, cacheKey?: string): ValidateFunction {
        const key = cacheKey ?? JSON.stringify(schema);
        const cached = this.cacheEnabled ? this.cache.get(key) : undefined;
        if (cached) return cached;

        const validate = this.ajv.compile(schema);
        if (this.cacheEnabled) this.cache.set(key, validate);
        log.debug(`compiled schema${cacheKey ? ` "${cacheKey}"` : ''}`);
        return validate;
    }

    /** Non-throwing check returning a structured result. */
    validate(data: unknown, schema: Schema, cacheKey?: string): ValidationResult {
        const validate = this.compile(schema, cacheKey);
        const valid = validate(data) as boolean;
        const errors = validate.errors ?? [];

        if (!valid) {
            const errorText = this.formatErrors(errors);
            log.info(`schema validation failed:\n${errorText}`);
            return { valid, errors, errorText };
        }
        return { valid: true, errors: [], errorText: '' };
    }

    /** Throwing check — raises {@link ValidationError} with a readable message. */
    assertValid(data: unknown, schema: Schema, cacheKey?: string): void {
        const { valid, errors, errorText } = this.validate(data, schema, cacheKey);
        if (!valid) {
            const label = cacheKey ? ` "${cacheKey}"` : '';
            throw new ValidationError(
                `JSON schema validation failed for${label}:\n${errorText}`,
                errors,
                errorText,
            );
        }
    }

    /** Readable multi-line summary of an Ajv error list. */
    formatErrors(errors?: ErrorObject[] | null): string {
        if (!errors || errors.length === 0) return '';
        return errors
            .map((error) => {
                const path = error.instancePath || '/';
                const detail = error.params ? ` ${JSON.stringify(error.params)}` : '';
                return `${path}: ${error.message ?? 'is invalid'}${detail}`;
            })
            .join('\n');
    }
}

export default SchemaValidator;

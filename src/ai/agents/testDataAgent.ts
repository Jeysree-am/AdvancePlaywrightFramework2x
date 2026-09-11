/**
 * testDataAgent — the first agent: generates booking test data.
 *
 * Its output contract is the `booking` definition of
 * `@testdata/schemas/create-booking.schema.json`, so an AI-generated payload is
 * held to exactly the same shape the API contract declares — no second schema to
 * drift out of sync.
 *
 *     const booking = await generateBookingData('a weekend stay with breakfast');
 */

import type { Schema } from 'ajv';
import type { Booking } from '@api/BookingApi';
import bookingPayloadJsonSchema from '@testdata/schemas/create-booking-payload.schema.json';
import { createAgent } from '@ai/agents/createAgent';

/**
 * The payload contract for `POST /booking`.
 *
 * This file is authoritative for the agent. `create-booking-ai-data.spec.ts`
 * asserts it stays identical to the `booking` definition of
 * `create-booking.schema.json`, so the request contract and the response
 * contract cannot drift apart.
 */
export const bookingPayloadSchema = bookingPayloadJsonSchema as Schema;

export const BOOKING_TEST_DATA_PROMPT = [
    'You generate realistic hotel booking payloads for the Restful Booker API (POST /booking).',
    '',
    'Rules:',
    '- firstname, lastname: realistic human names, non-empty.',
    '- totalprice: a whole number between 100 and 1000.',
    '- depositpaid: a boolean.',
    '- bookingdates.checkin, bookingdates.checkout: ISO dates (YYYY-MM-DD).',
    '- bookingdates.checkout must be strictly after bookingdates.checkin.',
    '- additionalneeds: exactly one of "Breakfast", "Late checkout", "Extra bed".',
    '',
    'Return only the booking object (the request body), never a bookingid wrapper.',
].join('\n');

export const bookingTestDataAgent = createAgent<Booking>({
    name: 'booking-test-data',
    systemPrompt: BOOKING_TEST_DATA_PROMPT,
    outputSchema: bookingPayloadSchema,
    temperature: 0.9,
});

const DEFAULT_BRIEF = 'A believable hotel stay a few days from now, breakfast included.';

/** Generate one schema-valid booking payload from a short natural-language brief. */
export async function generateBookingData(brief: string = DEFAULT_BRIEF): Promise<Booking> {
    return bookingTestDataAgent.run(brief);
}

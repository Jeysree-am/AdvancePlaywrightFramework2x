import { test, expect } from '@fixtures/booker.fixture';
import { SchemaValidator } from '@utils/SchemaValidator';
import { buildBooking } from '@testdata/booking.data';
import createBookingSchema from '@testdata/schemas/create-booking.schema.json';
import type { Schema } from 'ajv';

const validator = new SchemaValidator();
const schema = createBookingSchema as Schema;

test.describe('Create Booking response against its JSON schema', () => {
    test('TC#1 a created booking matches the schema', async ({ bookingApi }) => {
        const booking = await bookingApi.createBooking(buildBooking());

        const result = validator.validate(booking, schema);

        expect(result.valid, result.errorText).toBe(true);
    });

    test('TC#2 a response missing a required field is rejected', async ({ bookingApi }) => {
        const booking = await bookingApi.createBooking(buildBooking());
        delete (booking.booking as { lastname?: string }).lastname;

        const result = validator.validate(booking, schema);

        expect(result.valid).toBe(false);
        expect(result.errorText).toContain('lastname');
    });
});

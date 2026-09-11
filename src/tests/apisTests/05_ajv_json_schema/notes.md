# Create Booking — JSON Schema validation notes

Covers `create-booking-json-schema.spec.ts`, the `SchemaValidator` utility, and the
`create-booking.schema.json` contract. The goal is **contract testing**: assert that the
Create Booking response has the exact shape (types, required fields, field names) the rest
of the framework depends on, so a breaking API change fails fast with a readable message.

## Files involved

| File | Role |
|------|------|
| `src/tests/apisTests/05_ajv_json_schema/create-booking-json-schema.spec.ts` | The spec (positive + negative cases) |
| `src/testdata/schemas/create-booking.schema.json` | Draft-07 JSON Schema for the response |
| `src/utils/SchemaValidator.ts` | Ajv wrapper (`validate`, `assertValid`, error formatting) |
| `src/api/BookingApi.ts` | `createBooking()` service method used to drive the test |
| `src/testdata/booking.data.ts` | `buildBooking()` payload factory |

## API testcase flow

```
TC#1  a created booking matches the schema
  ├─ buildBooking()                         # random valid payload from DataGenerator
  ├─ bookingApi.createBooking(payload)      # POST /booking  -> 200
  ├─ validator.validate(response, schema)   # Ajv compiles + caches the schema
  └─ expect(result.valid).toBe(true)        # response conforms to the contract

TC#2  a response missing a required field is rejected
  ├─ buildBooking()
  ├─ bookingApi.createBooking(payload)      # POST /booking  -> 200
  ├─ delete booking.lastname                # corrupt the response in memory
  ├─ validator.validate(response, schema)
  ├─ expect(result.valid).toBe(false)       # schema catches the missing field
  └─ expect(result.errorText).toContain('lastname')
```

Why the negative case is built by corrupting a real response instead of hitting the API
with bad data: Restful Booker happily accepts a booking without `lastname`, so the API
itself would return `200`. The missing field is a **contract** violation, which is exactly
what the schema — not the API — is responsible for catching. Corrupting locally also keeps
the test deterministic and free of extra network calls.

## Request

`POST {{API_BASE_URL}}/booking`

Headers:

```
Content-Type: application/json
Accept: application/json
```

Body:

```json
{
  "firstname": "Jim",
  "lastname": "Brown",
  "totalprice": 111,
  "depositpaid": true,
  "bookingdates": {
    "checkin": "2026-10-20",
    "checkout": "2026-10-22"
  },
  "additionalneeds": "Breakfast"
}
```

No authentication required. The spec builds this body via `buildBooking()`, which fills
the fields from `DataGenerator` and pins the check-in date.

## Response

`200 OK` — body:

```json
{
  "bookingid": 4466,
  "booking": {
    "firstname": "Jim",
    "lastname": "Brown",
    "totalprice": 111,
    "depositpaid": true,
    "bookingdates": {
      "checkin": "2026-10-20",
      "checkout": "2026-10-22"
    },
    "additionalneeds": "Breakfast"
  }
}
```

The server echoes the payload back and wraps it under a generated numeric `bookingid`.
`additionalneeds` is optional — it is omitted from the response if not sent in the request.

## Schema contract

`create-booking.schema.json` encodes the shape above:

- Root: `bookingid` (integer >= 1) and `booking` (object) both required.
- `booking`: `firstname`, `lastname`, `totalprice`, `depositpaid`, `bookingdates` required;
  `additionalneeds` optional.
- `bookingdates`: `checkin` and `checkout` required, each a `format: "date"` string.
- `additionalProperties: false` at every level, so a renamed or unexpected field is a
  failure rather than silently passing.

`ajv-formats` is registered in `SchemaValidator`, which is what makes `format: "date"`
an actual check instead of an ignored keyword.

## How to run

```bash
# This spec only
npx playwright test src/tests/apisTests/05_ajv_json_schema/create-booking-json-schema.spec.ts --project=api --reporter=list

# Whole API suite
npx playwright test src/tests/apisTests --project=api
```

The spec runs only under the `api` project; `chromium` ignores `apisTests`.

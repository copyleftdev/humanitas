/**
 * Shared schema fragments reused across Humana's Apigee APIs.
 */
import { Schema } from "effect"

/** A US postal address, as used by Enrollment (`mailing_address`, `permanent_address`). */
export const Address = Schema.Struct({
  address_line_one: Schema.String,
  address_line_two: Schema.optional(Schema.String),
  city: Schema.String,
  state: Schema.String,
  zip_code: Schema.String,
  county: Schema.optional(Schema.String),
  fips: Schema.optional(Schema.String),
})
export type Address = Schema.Schema.Type<typeof Address>

/** A telephone number with an optional classification. */
export const PhoneType = Schema.Literal("Home", "Cell", "Work", "Other")
export type PhoneType = Schema.Schema.Type<typeof PhoneType>

/** The Humana Apigee error envelope: `{ errors: [{ code, detail, status }] }`. */
export const ApiError = Schema.Struct({
  code: Schema.String,
  detail: Schema.String,
  status: Schema.optional(Schema.Number),
})
export type ApiError = Schema.Schema.Type<typeof ApiError>

export const ApiErrors = Schema.Struct({
  errors: Schema.optional(Schema.Array(ApiError)),
})
export type ApiErrors = Schema.Schema.Type<typeof ApiErrors>

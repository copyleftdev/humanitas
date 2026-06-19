/**
 * The exhaustive, tagged error channel for every Humanitas call.
 *
 * Humana ships two distinct error envelopes:
 *   - the Apigee business APIs return `{ errors: [{ code, detail, status }] }`;
 *   - the FHIR server returns an `OperationOutcome` with
 *     `{ issue: [{ severity, code, diagnostics }] }`.
 * We normalize both into one discriminated union so callers
 * `Effect.catchTag("Forbidden", ...)` instead of pattern-matching on
 * stringly-typed status codes.
 *
 * One Humana-specific reality is first-class here: the gateway (and the FHIR
 * SMART layer) use **HTTP 403** liberally — `oauth.humana.com` answers
 * unauthenticated callers with `403 Access Denied`, and PHI FHIR resources
 * reject missing scopes with 403 — so `Forbidden` is its own tag, distinct
 * from `Unauthorized` (401, "Invalid access token").
 */
import { Data } from "effect"

/** A single field-level problem, normalized from the various envelopes. */
export interface FieldError {
  readonly code?: string
  readonly field?: string
  readonly value?: string
  readonly message: string
}

/** 400 — malformed request (also the FHIR "no search context" response). */
export class BadRequest extends Data.TaggedError("BadRequest")<{
  readonly message: string
  readonly errors: ReadonlyArray<FieldError>
  readonly requestId?: string
}> {}

/** 401 — invalid/expired bearer token ("Invalid access token"). */
export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly message: string
  readonly requestId?: string
}> {}

/** 403 — gateway access denied / missing FHIR scope. */
export class Forbidden extends Data.TaggedError("Forbidden")<{
  readonly message: string
  readonly errors: ReadonlyArray<FieldError>
  readonly requestId?: string
}> {}

/** 404 — no endpoint matched, or no results for the parameters. */
export class NotFound extends Data.TaggedError("NotFound")<{
  readonly message: string
  readonly requestId?: string
}> {}

/** 422 — validation failure with a structured field-error list. */
export class Unprocessable extends Data.TaggedError("Unprocessable")<{
  readonly message: string
  readonly errors: ReadonlyArray<FieldError>
  readonly requestId?: string
}> {}

/** 429 — gateway throttling. */
export class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly message: string
  readonly retryAfterSeconds?: number
}> {}

/** 5xx — server-side failure. */
export class ServerError extends Data.TaggedError("ServerError")<{
  readonly status: number
  readonly message: string
  readonly requestId?: string
}> {}

/** Network/connection failure before a response was received. */
export class TransportError extends Data.TaggedError("TransportError")<{
  readonly message: string
  readonly cause: unknown
}> {}

/** A 2xx body that failed schema decoding (contract drift). */
export class DecodeError extends Data.TaggedError("DecodeError")<{
  readonly message: string
  readonly cause: unknown
}> {}

/** Failure obtaining an OAuth client-credentials token. */
export class AuthError extends Data.TaggedError("AuthError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** The complete, closed set of failures any Humanitas effect can produce. */
export type HumanitasError =
  | BadRequest
  | Unauthorized
  | Forbidden
  | NotFound
  | Unprocessable
  | RateLimited
  | ServerError
  | TransportError
  | DecodeError
  | AuthError

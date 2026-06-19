/**
 * The transport core: the `request` / `fhirRequest` combinators every resource
 * is built on.
 *
 * Responsibilities:
 *   - attach the bearer token (from {@link TokenProvider}) and the per-app
 *     `x-api-key` to every *gateway* call;
 *   - serve *FHIR* calls against a separate origin, tokenless by default (the
 *     Da Vinci PDEX Plan-Net provider directory is public) with an optional
 *     caller-supplied SMART bearer for PHI resources;
 *   - decode 2xx bodies through the operation's `Schema` (contract-checked);
 *   - normalize non-2xx status codes into the tagged {@link HumanitasError}
 *     union, lifting both Humana's `errors[]` envelope and the FHIR
 *     `OperationOutcome` into a uniform shape;
 *   - transparently refresh the token and retry once on a 401.
 */
import { Headers, HttpClient, HttpClientRequest } from "@effect/platform"
import { Effect, Option, Redacted, Schema } from "effect"
import { HumanitasConfig } from "./config.js"
import { TokenProvider } from "./auth.js"
import {
  BadRequest,
  DecodeError,
  type FieldError,
  Forbidden,
  NotFound,
  RateLimited,
  ServerError,
  TransportError,
  type HumanitasError,
  Unauthorized,
  Unprocessable,
} from "./errors.js"

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface RequestSpec<A, I> {
  readonly method: Method
  /** Path relative to the configured `baseUrl`, beginning with `/`. */
  readonly path: string
  /** Query parameters; `undefined` values are dropped. */
  readonly query?: Record<string, string | undefined>
  /** JSON request body (already encoded to plain data). */
  readonly body?: unknown
  /** Extra request headers (e.g. `x-channel-code`); merged over the defaults. */
  readonly headers?: Record<string, string>
  /** Schema used to decode a 2xx response body. */
  readonly response: Schema.Schema<A, I>
}

export interface FhirRequestSpec<A, I> extends RequestSpec<A, I> {
  /**
   * An optional SMART-on-FHIR bearer token. Omit it for the public provider
   * directory (Practitioner/Organization/Location/InsurancePlan/
   * PractitionerRole); supply it for PHI resources (Patient, Coverage, ...),
   * which answer tokenless callers with 401 "Invalid access token".
   */
  readonly token?: Redacted.Redacted<string>
}

/** Context required by a gateway call. */
export type RequestContext =
  | HumanitasConfig
  | TokenProvider
  | HttpClient.HttpClient

/** Context required by a FHIR call (no token provider needed). */
export type FhirContext = HumanitasConfig | HttpClient.HttpClient

// A deliberately permissive view over both the Humana `errors[]` envelope and
// the FHIR `OperationOutcome`.
const ErrorEnvelope = Schema.Struct({
  message: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
  // Humana Apigee envelope: { errors: [{ code, detail, status }] }
  errors: Schema.optional(
    Schema.Array(
      Schema.Struct({
        code: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
        field: Schema.optional(Schema.String),
        detail: Schema.optional(Schema.String),
        value: Schema.optional(Schema.String),
        message: Schema.optional(Schema.String),
        status: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
      }),
    ),
  ),
  // FHIR OperationOutcome: { issue: [{ severity, code, diagnostics, details }] }
  issue: Schema.optional(
    Schema.Array(
      Schema.Struct({
        severity: Schema.optional(Schema.String),
        code: Schema.optional(Schema.String),
        diagnostics: Schema.optional(Schema.String),
        details: Schema.optional(
          Schema.Struct({ text: Schema.optional(Schema.String) }),
        ),
      }),
    ),
  ),
})

const decodeEnvelope = Schema.decodeUnknownOption(ErrorEnvelope)

const requestId = (headers: Headers.Headers): string | undefined =>
  Headers.get(headers, "x-request-id").pipe((o) =>
    Option.isSome(o)
      ? o.value
      : Headers.get(headers, "x-correlation-id").pipe((c) =>
          Option.isSome(c) ? c.value : undefined,
        ),
  )

const toFieldErrors = (
  body: unknown,
): { message: string; errors: ReadonlyArray<FieldError> } => {
  const parsed = decodeEnvelope(body)
  if (Option.isNone(parsed)) {
    return { message: "Request failed", errors: [] }
  }
  const env = parsed.value
  // Humana Apigee `errors[]`
  if (env.errors && env.errors.length > 0) {
    const errors: ReadonlyArray<FieldError> = env.errors.map((e) => ({
      code: e.code === undefined ? undefined : String(e.code),
      field: e.field,
      value: e.value,
      message: e.detail ?? e.message ?? "Request failed",
    }))
    return { message: errors[0]?.message ?? "Request failed", errors }
  }
  // FHIR OperationOutcome `issue[]`
  if (env.issue && env.issue.length > 0) {
    const errors: ReadonlyArray<FieldError> = env.issue.map((i) => ({
      code: i.code,
      message: i.diagnostics ?? i.details?.text ?? i.severity ?? "Issue",
    }))
    return { message: errors[0]?.message ?? "Request failed", errors }
  }
  const message =
    env.message ?? env.error_description ?? env.error ?? "Request failed"
  return { message, errors: [] }
}

const construct = (
  method: Method,
  url: string,
): HttpClientRequest.HttpClientRequest => {
  switch (method) {
    case "GET":
      return HttpClientRequest.get(url)
    case "POST":
      return HttpClientRequest.post(url)
    case "PUT":
      return HttpClientRequest.put(url)
    case "PATCH":
      return HttpClientRequest.patch(url)
    case "DELETE":
      return HttpClientRequest.del(url)
  }
}

const cleanQuery = (
  query: Record<string, string | undefined> | undefined,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(query ?? {}).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )

/** Shared body decode + error normalization for a received response. */
const handle = <A, I>(
  response: { status: number; headers: Headers.Headers; json: Effect.Effect<unknown, unknown> },
  responseSchema: Schema.Schema<A, I>,
): Effect.Effect<A, HumanitasError> =>
  Effect.gen(function* () {
    const status = response.status
    const rid = requestId(response.headers)

    if (status >= 200 && status < 300) {
      const body =
        status === 204
          ? {}
          : yield* response.json.pipe(
              Effect.mapError(
                (cause): HumanitasError =>
                  new TransportError({ message: "Failed reading body", cause }),
              ),
            )
      return yield* Schema.decodeUnknown(responseSchema)(body).pipe(
        Effect.mapError(
          (cause): HumanitasError =>
            new DecodeError({
              message: "Response body did not match the expected schema",
              cause,
            }),
        ),
      )
    }

    const raw = yield* response.json.pipe(Effect.orElseSucceed(() => ({})))
    const { message, errors } = toFieldErrors(raw)

    switch (status) {
      case 400:
        return yield* Effect.fail(new BadRequest({ message, errors, requestId: rid }))
      case 401:
        return yield* Effect.fail(new Unauthorized({ message, requestId: rid }))
      case 403:
        return yield* Effect.fail(new Forbidden({ message, errors, requestId: rid }))
      case 404:
        return yield* Effect.fail(new NotFound({ message, requestId: rid }))
      case 422:
        return yield* Effect.fail(new Unprocessable({ message, errors, requestId: rid }))
      case 429: {
        const ra = Headers.get(response.headers, "retry-after")
        return yield* Effect.fail(
          new RateLimited({
            message,
            retryAfterSeconds: Option.isSome(ra) ? Number(ra.value) : undefined,
          }),
        )
      }
      default:
        return yield* Effect.fail(new ServerError({ status, message, requestId: rid }))
    }
  })

/**
 * Execute a typed *gateway* request. Attaches the client-credentials bearer and
 * the per-app `x-api-key`, refreshes-and-retries once on a 401. The error
 * channel is the full {@link HumanitasError} union; success is the decoded `A`.
 */
export const request = <A, I>(
  spec: RequestSpec<A, I>,
): Effect.Effect<A, HumanitasError, RequestContext> => {
  const once = Effect.scoped(
    Effect.gen(function* () {
      const config = yield* HumanitasConfig
      const tokens = yield* TokenProvider
      const client = yield* HttpClient.HttpClient
      const token = yield* tokens.accessToken

      let httpReq = construct(spec.method, `${config.baseUrl}${spec.path}`).pipe(
        HttpClientRequest.setHeaders({
          Authorization: `Bearer ${Redacted.value(token)}`,
          "x-humana-api-key": Redacted.value(config.apiKey),
          Accept: "application/json",
          ...(spec.headers ?? {}),
        }),
        HttpClientRequest.setUrlParams(cleanQuery(spec.query)),
      )
      if (spec.body !== undefined) {
        httpReq = HttpClientRequest.bodyUnsafeJson(httpReq, spec.body)
      }

      const response = yield* client.execute(httpReq).pipe(
        Effect.mapError(
          (cause): HumanitasError =>
            new TransportError({ message: "HTTP transport failure", cause }),
        ),
      )
      return yield* handle(response, spec.response)
    }),
  )

  // Refresh-and-retry once on a stale token.
  return once.pipe(
    Effect.catchTag("Unauthorized", (err) =>
      Effect.flatMap(TokenProvider, (t) => t.invalidate).pipe(
        Effect.zipRight(once),
        Effect.catchTag("Unauthorized", () => Effect.fail(err)),
      ),
    ),
  )
}

/**
 * Execute a typed *FHIR* request against `fhirBaseUrl`. Tokenless by default
 * (public provider directory); pass `spec.token` for PHI resources.
 */
export const fhirRequest = <A, I>(
  spec: FhirRequestSpec<A, I>,
): Effect.Effect<A, HumanitasError, FhirContext> =>
  Effect.scoped(
    Effect.gen(function* () {
      const config = yield* HumanitasConfig
      const client = yield* HttpClient.HttpClient

      const headers: Record<string, string> = {
        Accept: "application/fhir+json",
      }
      if (spec.token !== undefined) {
        headers.Authorization = `Bearer ${Redacted.value(spec.token)}`
      }

      let httpReq = construct(
        spec.method,
        `${config.fhirBaseUrl}${spec.path}`,
      ).pipe(
        HttpClientRequest.setHeaders(headers),
        HttpClientRequest.setUrlParams(cleanQuery(spec.query)),
      )
      if (spec.body !== undefined) {
        httpReq = HttpClientRequest.bodyUnsafeJson(httpReq, spec.body)
      }

      const response = yield* client.execute(httpReq).pipe(
        Effect.mapError(
          (cause): HumanitasError =>
            new TransportError({ message: "HTTP transport failure", cause }),
        ),
      )
      return yield* handle(response, spec.response)
    }),
  )

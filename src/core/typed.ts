/**
 * Generic, fully-inferred operation combinator over an `openapi-typescript`
 * `paths` type.
 *
 * `api<paths>()` returns a `call(path, method, init)` function where the path
 * parameters, query, request body, and success response are all *inferred from
 * the generated type* — no per-endpoint wiring. Path params and bodies are
 * required exactly when the spec says so, and unknown paths/methods don't
 * type-check. This is how every Humana Apigee API becomes callable from one
 * ~40-line core, while the curated resources (Enrollment, Plan Info) keep
 * runtime `effect/Schema` decoding on top.
 */
import { Effect, Schema } from "effect"
import { request, type Method, type RequestContext } from "./http.js"
import type { HumanitasError } from "./errors.js"

/** Lowercase HTTP verbs, matching the generated `paths[path]` keys. */
export type HttpVerb = "get" | "put" | "post" | "delete" | "patch"

type JsonOf<T> = T extends { content: { "application/json": infer C } }
  ? C
  : never

type SuccessStatus = 200 | 201 | 202 | 203 | 204

/** The union of `application/json` bodies across all 2xx responses. */
type OkBody<Op> = Op extends { responses: infer R }
  ? JsonOf<R[Extract<keyof R, SuccessStatus>]>
  : never

type PathParamsOf<Op> = Op extends { parameters: { path: infer P } }
  ? P extends Record<string, unknown>
    ? P
    : Record<never, never>
  : Record<never, never>

type QueryOf<Op> = Op extends { parameters: { query?: infer Q } }
  ? [Q] extends [undefined]
    ? Record<never, never>
    : NonNullable<Q>
  : Record<never, never>

type RequestBodyOf<Op> = Op extends { requestBody?: infer R } ? R : undefined

// JsonOf distributes over a naked type parameter, so JsonOf<never> === never —
// which is exactly what we want when an operation has no request body.
type BodyOf<Op> = JsonOf<NonNullable<RequestBodyOf<Op>>>

type HasKeys<T> = [keyof T] extends [never] ? false : true

/** The keys of `T` that are required (no `?`). */
type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K
}[keyof T]

/**
 * The request init for an operation — each member appears (and is required)
 * only when the operation actually has it.
 */
export type OpInit<Op> = (HasKeys<PathParamsOf<Op>> extends true
  ? { readonly path: PathParamsOf<Op> }
  : Record<never, never>) &
  (HasKeys<QueryOf<Op>> extends true
    ? { readonly query?: QueryOf<Op> }
    : Record<never, never>) &
  ([BodyOf<Op>] extends [never]
    ? Record<never, never>
    : { readonly body: BodyOf<Op> })

const interpolate = (
  template: string,
  params: Record<string, unknown>,
): string =>
  template.replace(/\{([^}]+)\}/g, (_m, key: string) =>
    encodeURIComponent(String(params[key])),
  )

const toQuery = (
  q: Record<string, unknown> | undefined,
): Record<string, string | undefined> | undefined => {
  if (q == null) return undefined
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(q)) {
    out[k] = v === undefined ? undefined : String(v)
  }
  return out
}

/**
 * Build a typed caller bound to a generated `paths` type:
 *
 *   const call = api<import("../generated/agent.js").paths>()
 *   call("/{san}", "get", { path: { san: "12345" } })
 *   // Effect<AgentResponse, HumanitasError, RequestContext>
 *
 * NOTE: responses are typed but not runtime-decoded (we trust the generated
 * type and pass the body through `Schema.Unknown`). Layer an `effect/Schema`
 * resource on top when you want validation.
 */
export const api =
  <Paths>() =>
  <P extends keyof Paths & string, M extends keyof Paths[P] & HttpVerb>(
    path: P,
    method: M,
    ...args: [RequiredKeys<OpInit<Paths[P][M]>>] extends [never]
      ? [init?: OpInit<Paths[P][M]>]
      : [init: OpInit<Paths[P][M]>]
  ): Effect.Effect<OkBody<Paths[P][M]>, HumanitasError, RequestContext> => {
    const init = (args[0] ?? {}) as {
      path?: Record<string, unknown>
      query?: Record<string, unknown>
      body?: unknown
    }
    return request({
      method: method.toUpperCase() as Method,
      path: interpolate(path, init.path ?? {}),
      query: toQuery(init.query),
      body: init.body,
      response: Schema.Unknown,
    }) as unknown as Effect.Effect<
      OkBody<Paths[P][M]>,
      HumanitasError,
      RequestContext
    >
  }

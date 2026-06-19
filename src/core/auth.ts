/**
 * OAuth 2.0 client-credentials token provider.
 *
 * Humana fronts the business APIs with an Apigee gateway using the
 * client-credentials grant (JWT bearer); `oauth.humana.com` answers
 * unauthenticated callers with `403 Access Denied`. This service obtains a
 * token, caches it in a `Ref`, and transparently refreshes it shortly before
 * expiry. The token never leaves the `Redacted` wrapper, so it cannot be
 * accidentally logged.
 */
import { HttpClient, HttpClientRequest } from "@effect/platform"
import {
  Clock,
  Context,
  Effect,
  Encoding,
  Layer,
  Option,
  Redacted,
  Ref,
  Schema,
} from "effect"
import { AuthError } from "./errors.js"
import { HumanitasConfig } from "./config.js"

export interface TokenProviderService {
  /** A fresh (cached, auto-refreshing) bearer token. */
  readonly accessToken: Effect.Effect<Redacted.Redacted<string>, AuthError>
  /** Force the next `accessToken` to re-fetch (e.g. after a 401). */
  readonly invalidate: Effect.Effect<void>
}

export class TokenProvider extends Context.Tag("@humanitas/TokenProvider")<
  TokenProvider,
  TokenProviderService
>() {}

interface CachedToken {
  readonly token: Redacted.Redacted<string>
  readonly expiresAtMillis: number
}

const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
})

/** Refresh this many ms before the real expiry to avoid edge-of-window 401s. */
const REFRESH_SKEW_MS = 30_000

/**
 * The live token provider. Requires an `HttpClient` and `HumanitasConfig`.
 */
export const layer: Layer.Layer<
  TokenProvider,
  never,
  HttpClient.HttpClient | HumanitasConfig
> = Layer.effect(
  TokenProvider,
  Effect.gen(function* () {
    const config = yield* HumanitasConfig
    const client = yield* HttpClient.HttpClient
    const cache = yield* Ref.make<Option.Option<CachedToken>>(Option.none())

    const fetchToken: Effect.Effect<CachedToken, AuthError> = Effect.scoped(
      Effect.gen(function* () {
        const basic = Encoding.encodeBase64(
          `${config.clientId}:${Redacted.value(config.clientSecret)}`,
        )

        const request = HttpClientRequest.post(config.tokenUrl).pipe(
          HttpClientRequest.setHeaders({
            Authorization: `Basic ${basic}`,
            Accept: "application/json",
          }),
          HttpClientRequest.bodyUrlParams({
            grant_type: "client_credentials",
          }),
        )

        const response = yield* client.execute(request)
        const body = yield* response.json
        const decoded = yield* Schema.decodeUnknown(TokenResponse)(body)
        const now = yield* Clock.currentTimeMillis
        const ttl = (decoded.expires_in ?? 3600) * 1000
        return {
          token: Redacted.make(decoded.access_token),
          expiresAtMillis: now + ttl - REFRESH_SKEW_MS,
        }
      }),
    ).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Failed to obtain client-credentials token",
            cause,
          }),
      ),
    )

    const accessToken: Effect.Effect<Redacted.Redacted<string>, AuthError> =
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const current = yield* Ref.get(cache)
        if (Option.isSome(current) && current.value.expiresAtMillis > now) {
          return current.value.token
        }
        const fresh = yield* fetchToken
        yield* Ref.set(cache, Option.some(fresh))
        return fresh.token
      })

    const invalidate = Ref.set(cache, Option.none())

    return { accessToken, invalidate }
  }),
)

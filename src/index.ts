/**
 * Humanitas — an elite, Effect-native TypeScript SDK for the Humana Data
 * Exchange APIs (unofficial).
 *
 *   import { Humanitas } from "@humanitas/sdk"
 *
 *   const program = Humanitas.enrollment
 *     .submit()
 *     .channel("WEB")
 *     .body(application)
 *     .send()                                   // ← only callable once complete
 *     .pipe(Effect.catchTag("Unprocessable", recover))
 *
 *   await Humanitas.run(program, {
 *     baseUrl: "https://api.humana.com",
 *     tokenUrl: "https://oauth.humana.com/oauth2/token",
 *     clientId, clientSecret, apiKey,
 *   })
 *
 * The FHIR provider directory needs no credentials at all:
 *
 *   await Humanitas.run(
 *     Humanitas.fhir.directory.practitioner({ name: "smith" }),
 *     publicFhirConfig,
 *   )
 */
import { FetchHttpClient } from "@effect/platform"
import { Effect, Layer } from "effect"
import * as ConfigModule from "./core/config.js"
import { layer as TokenProviderLayer } from "./core/auth.js"
import type { RequestContext } from "./core/http.js"

import { agent } from "./resources/agent.js"
import { drugList } from "./resources/drugList.js"
import { enrollment } from "./resources/enrollment.js"
import { enrollmentReporting } from "./resources/enrollmentReporting.js"
import { idvEnrollment } from "./resources/idvEnrollment.js"
import { planInformation } from "./resources/planInformation.js"
import { smallGroup } from "./resources/smallGroup.js"
import { fhir } from "./fhir/client.js"

import * as CommonSchema from "./schema/common.js"
import * as EnrollmentSchema from "./schema/enrollment.js"
import * as FhirSchema from "./fhir/schema.js"

import * as Brand from "./core/brand.js"
import * as Errors from "./core/errors.js"

export { HumanitasConfig } from "./core/config.js"
export type { HumanitasError } from "./core/errors.js"
export type { RequestContext, FhirContext } from "./core/http.js"
export { Brand, Errors }

/**
 * The fully-wired live runtime layer: config + a `fetch`-backed HttpClient +
 * the auto-refreshing client-credentials token provider.
 */
export const layer = (
  input: ConfigModule.HumanitasConfigInput,
): Layer.Layer<RequestContext> => {
  const configLive = ConfigModule.layer(input)
  const httpLive = FetchHttpClient.layer
  const tokenLive = TokenProviderLayer.pipe(
    Layer.provide(Layer.merge(httpLive, configLive)),
  )
  return Layer.mergeAll(configLive, httpLive, tokenLive)
}

/** Run a Humanitas program to a Promise with a live runtime built from `input`. */
export const run = <A, E>(
  effect: Effect.Effect<A, E, RequestContext>,
  input: ConfigModule.HumanitasConfigInput,
): Promise<A> => Effect.runPromise(Effect.provide(effect, layer(input)))

/**
 * The single fluent entry point. Resources return `Effect`s requiring
 * {@link RequestContext} (or, for FHIR, the smaller `FhirContext`); provide it
 * once via {@link layer}/{@link run}.
 */
export const Humanitas = {
  // Curated resource (effect/Schema validation + type-state builder)
  enrollment,
  // Generic resources (named methods over the typed combinator)
  agent,
  smallGroup,
  planInformation,
  idvEnrollment,
  enrollmentReporting,
  drugList,
  // FHIR R4 (public directory + SMART-gated clinical)
  fhir,
  layer,
  run,
  Config: ConfigModule,
  /** Branded id constructors (`AgentSan`, `EnrollmentId`, ...). */
  Brand,
  /** The tagged error union and its members. */
  Errors,
  /** All decoded/encoded domain schemas, grouped by API. */
  Schema: {
    Common: CommonSchema,
    Enrollment: EnrollmentSchema,
    FHIR: FhirSchema,
  },
} as const

export type Humanitas = typeof Humanitas

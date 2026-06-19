/**
 * Configuration as an Effect service.
 *
 * Published specs declare backend hosts that aren't the real public ingress;
 * traffic flows through the Apigee gateway, and every app needs its own
 * portal-issued client credentials + API key. So all of that is supplied here
 * as a `Context` service rather than hard-coded — which makes pointing at
 * sandbox vs. production just a matter of which `Layer` you provide.
 *
 * `fhirBaseUrl` is separate because the FHIR server is a distinct origin
 * (`fhir.humana.com/api`) with its own SMART OAuth and a partly-public surface
 * (the Da Vinci PDEX Plan-Net provider directory needs no token at all).
 */
import { Config, Context, Layer, Redacted } from "effect"

export interface HumanitasConfigService {
  /** Apigee gateway origin for the business APIs, e.g. `https://api.humana.com`. */
  readonly baseUrl: string
  /** FHIR server origin, e.g. `https://fhir.humana.com/api`. */
  readonly fhirBaseUrl: string
  /** OAuth 2.0 client-credentials token endpoint. */
  readonly tokenUrl: string
  readonly clientId: string
  readonly clientSecret: Redacted.Redacted<string>
  /** Per-app API key sent on every gateway request alongside the bearer token. */
  readonly apiKey: Redacted.Redacted<string>
}

export class HumanitasConfig extends Context.Tag("@humanitas/Config")<
  HumanitasConfig,
  HumanitasConfigService
>() {}

export interface HumanitasConfigInput {
  readonly baseUrl: string
  readonly tokenUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly apiKey: string
  /** Optional; defaults to `https://fhir.humana.com/api`. */
  readonly fhirBaseUrl?: string
}

const DEFAULT_FHIR_BASE = "https://fhir.humana.com/api"
const trimSlash = (s: string): string => s.replace(/\/+$/, "")

/** Build a config layer from plain values. */
export const layer = (
  input: HumanitasConfigInput,
): Layer.Layer<HumanitasConfig> =>
  Layer.succeed(HumanitasConfig, {
    baseUrl: trimSlash(input.baseUrl),
    fhirBaseUrl: trimSlash(input.fhirBaseUrl ?? DEFAULT_FHIR_BASE),
    tokenUrl: input.tokenUrl,
    clientId: input.clientId,
    clientSecret: Redacted.make(input.clientSecret),
    apiKey: Redacted.make(input.apiKey),
  })

/**
 * Build a config layer from the environment:
 *   HUMANITAS_BASE_URL, HUMANITAS_TOKEN_URL, HUMANITAS_CLIENT_ID,
 *   HUMANITAS_CLIENT_SECRET, HUMANITAS_API_KEY, [HUMANITAS_FHIR_BASE_URL]
 */
export const fromEnv: Layer.Layer<HumanitasConfig, ConfigError> = Layer.effect(
  HumanitasConfig,
  Config.all({
    baseUrl: Config.string("HUMANITAS_BASE_URL"),
    tokenUrl: Config.string("HUMANITAS_TOKEN_URL"),
    clientId: Config.string("HUMANITAS_CLIENT_ID"),
    clientSecret: Config.redacted("HUMANITAS_CLIENT_SECRET"),
    apiKey: Config.redacted("HUMANITAS_API_KEY"),
    fhirBaseUrl: Config.string("HUMANITAS_FHIR_BASE_URL").pipe(
      Config.withDefault(DEFAULT_FHIR_BASE),
    ),
  }).pipe(
    Config.map((c) => ({
      ...c,
      baseUrl: trimSlash(c.baseUrl),
      fhirBaseUrl: trimSlash(c.fhirBaseUrl),
    })),
  ),
)

// Re-export the Config error type for ergonomic signatures.
import type { ConfigError } from "effect/ConfigError"
export type { ConfigError }

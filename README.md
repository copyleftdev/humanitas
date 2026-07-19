# Humanitas

[![Tip my tokens](https://tokentip.to/badge/copyleftdev.svg?logo=1)](https://tokentip.to/@copyleftdev)

> An elite, **Effect-native** TypeScript SDK for the **Humana Data Exchange** APIs — *unofficial*.

Humanitas is to Humana what [Tutela](../../gardian-inc/tutela) is to Guardian: a hand-crafted, fully-typed client built on [Effect](https://effect.website) over the provider's published OpenAPI/Swagger and FHIR specifications. Every call returns a typed `Effect` with a closed, tagged error channel; ids are nominally branded; and request builders are gated by the type system so an incomplete call **does not compile**.

> ⚠️ **Unofficial & for authorized use only.** Built from publicly-published API specifications. You must supply your own Humana-issued client credentials and API key, and use it only within the terms of your Humana Data Exchange agreement.

## Why it exists

The Humana developer portal publishes raw specs for its Apigee business APIs and a FHIR R4 CapabilityStatement. Humanitas turns those into a single, ergonomic, type-safe surface:

| Layer | What it gives you |
|---|---|
| **Branded ids** (`AgentSan`, `EnrollmentId`, `PlanCode`, `Fips`, …) | A `PartnerId` can never be passed where an `AgentSan` is expected. |
| **Tagged errors** (`Unauthorized`, **`Forbidden`**, `Unprocessable`, `RateLimited`, …) | `Effect.catchTag("Forbidden", …)` instead of switching on status codes. Humana's heavy use of **403** gets its own tag, distinct from 401. |
| **Type-state builders** | `enrollment.submit().body(app).send()` compiles; dropping `.body()` is a *compile error*. |
| **OAuth + auto-refresh** | Client-credentials token cached in a `Ref`, refreshed before expiry, never logged (`Redacted`), retried once on 401. |
| **FHIR two-tier client** | The public Da Vinci Plan-Net **provider directory** needs no token; **clinical/PHI** methods *require* a SMART bearer — enforced in the types. |

## Install

```bash
pnpm add @humanitas/sdk effect @effect/platform
```

## Quick start

### A gateway call — Medicare enrollment (type-state builder)

```ts
import { Effect } from "effect"
import { Humanitas } from "@humanitas/sdk"

const program = Humanitas.enrollment
  .submit()
  .channel("WEB")          // optional sales channel header
  .body(application)        // ← required; omit it and .send() won't compile
  .send()
  .pipe(
    Effect.catchTag("Unprocessable", (e) => Effect.logError(e.message).pipe(Effect.as(null))),
    Effect.catchTag("Forbidden", () => Effect.die("check credentials / api key")),
  )

await Humanitas.run(program, {
  baseUrl: "https://api.humana.com",
  tokenUrl: "https://oauth.humana.com/oauth2/token",
  clientId, clientSecret, apiKey,
})
```

### A FHIR call — public provider directory (no credentials)

```ts
const providers = Humanitas.fhir.directory.practitioner({ name: "smith", _count: 5 })
await Humanitas.run(providers, publicConfig)   // tokenless — Plan-Net is public
```

### A FHIR call — PHI (SMART bearer required by the type)

```ts
// `clinical.*` methods will not type-check without a token argument:
const patient = Humanitas.fhir.clinical.patient(id, smartBearer)
```

## API surface

- **`enrollment`** — Medicare Enrollment (curated `effect/Schema` + type-state submit builder), `status`, `pharmacyConsent`
- **`agent`** — Agents API: `get`, `plans`, `allPlans`, `certifications`, `licenses`
- **`smallGroup`** — Small Groups Book of Business: `bob`, `group`
- **`planInformation`** — Plan Info V2: `medicarePlans`, `medicareSupplementPlans`, `medicareSupplementQuotes`, `osbs`, `idvPlans`, `rateCalculator`
- **`idvEnrollment`** — IDV Enrollment (production host) `submit`
- **`enrollmentReporting`** — `bam`, `aped`
- **`drugList`** — `save`
- **`fhir`** — `metadata`, `directory.*` (public), `clinical.*` (SMART-gated)

## Architecture

```
src/
  core/         brand · errors · config · auth · http · request-builder · typed
  generated/    openapi-typescript output (one module per API)
  resources/    Effect-native clients (curated or generic over `typed`)
  schema/       effect/Schema for curated request/response types
  fhir/         FHIR R4 client (public directory + SMART clinical) + schema
  index.ts      the `Humanitas` entry point + `layer`/`run`
```

The same `typed.ts` combinator infers path params, query, body, and the success
type straight from each generated `paths` type, so a whole API comes online in a
few lines while curated resources layer runtime schema decoding on top.

## Regenerating types

Humana publishes most Apigee specs as **Swagger 2.0** (which `openapi-typescript`
v7 rejects), so `scripts/gen.sh` converts 2.0 → 3.0 with `swagger2openapi` first.

```bash
pnpm gen        # specs/*.{json,yaml} -> specs/openapi3/*.json -> src/generated/*.ts
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT. Not affiliated with, endorsed by, or sponsored by Humana Inc.

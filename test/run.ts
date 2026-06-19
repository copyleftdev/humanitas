/**
 * Smoke tests. Exercise the pure, runtime-checkable surface (branding, error
 * normalization, builder construction) without any network. Exits non-zero on
 * failure.
 */
import { Effect, Either, Redacted } from "effect"
import * as Brand from "../src/core/brand.js"
import * as Errors from "../src/core/errors.js"
import * as Config from "../src/core/config.js"
import { Humanitas } from "../src/index.js"

let pass = 0
let fail = 0
const ok = (name: string, cond: boolean): void => {
  if (cond) {
    pass++
  } else {
    fail++
    console.error(`✗ ${name}`)
  }
}

// --- Branding ----------------------------------------------------------------
ok("AgentSan accepts digits", Either.isRight(Brand.AgentSan.either("12345")))
ok("AgentSan rejects non-digits", Either.isLeft(Brand.AgentSan.either("12a45")))
ok("Fips requires 5 digits", Either.isLeft(Brand.Fips.either("123")))
ok("Fips accepts 5 digits", Either.isRight(Brand.Fips.either("21111")))
ok("EnrollmentId rejects empty", Either.isLeft(Brand.EnrollmentId.either("")))

// --- Error union -------------------------------------------------------------
const forbidden = new Errors.Forbidden({ message: "Access Denied", errors: [] })
ok("Forbidden is tagged 403-style", forbidden._tag === "Forbidden")
ok(
  "Unauthorized distinct from Forbidden",
  new Errors.Unauthorized({ message: "x" })._tag !== forbidden._tag,
)

// --- Config layer ------------------------------------------------------------
const cfg = Config.layer({
  baseUrl: "https://api.humana.com/",
  tokenUrl: "https://oauth.humana.com/oauth2/token",
  clientId: "id",
  clientSecret: "secret",
  apiKey: "key",
})
const baseUrl = Effect.runSync(
  Effect.provide(
    Effect.map(Config.HumanitasConfig, (c) => c.baseUrl),
    cfg,
  ),
)
ok("Config trims trailing slash", baseUrl === "https://api.humana.com")
const fhirBase = Effect.runSync(
  Effect.provide(
    Effect.map(Config.HumanitasConfig, (c) => c.fhirBaseUrl),
    cfg,
  ),
)
ok("Config defaults FHIR base", fhirBase === "https://fhir.humana.com/api")
const secretRedacted = Effect.runSync(
  Effect.provide(
    Effect.map(Config.HumanitasConfig, (c) => Redacted.value(c.clientSecret)),
    cfg,
  ),
)
ok("clientSecret stored redacted", secretRedacted === "secret")

// --- Builder construction (no network) ---------------------------------------
const builder = Humanitas.enrollment.submit().channel("WEB")
ok("submit builder constructs", typeof builder.body === "function")
ok(
  "fhir directory + clinical namespaces present",
  typeof Humanitas.fhir.directory.practitioner === "function" &&
    typeof Humanitas.fhir.clinical.patient === "function",
)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

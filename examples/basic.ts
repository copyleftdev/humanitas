/**
 * Humanitas usage example. Provide real credentials to `Humanitas.run`.
 */
import { Effect } from "effect"
import { Humanitas } from "../src/index.js"
import type { Application } from "../src/schema/enrollment.js"

const application: Application = {
  agent: { agent_name: "A. Broker", agent_san: 123456 },
  applicant: {
    first_name: "Ada",
    last_name: "Lovelace",
    date_of_birth: "1955-12-10",
    gender: "female",
    medicare_claim_number: "1EG4-TE5-MK73",
    hospital_insurance_parta: "2020-12-01",
    medical_insurance_partb: "2020-12-01",
    phone_number: "5025551212",
    permanent_address: {
      address_line_one: "1 Innovation Way",
      city: "Louisville",
      state: "KY",
      zip_code: "40202",
    },
  },
}

// --- Gateway call: Medicare enrollment (type-state builder) ------------------
const enroll = Humanitas.enrollment
  .submit()
  .channel("WEB")
  .body(application)
  .send() // ✓ body provided
  .pipe(
    Effect.tap((r) => Effect.log(`enrollment_id=${r.enrollment_id ?? "?"}`)),
    Effect.catchTag("Unprocessable", (e) =>
      Effect.logError(`validation failed: ${e.message}`).pipe(
        Effect.as({ status: "rejected" as const }),
      ),
    ),
    Effect.catchTag("Forbidden", () =>
      Effect.die("gateway access denied — check client credentials / api key"),
    ),
  )

// --- Type-state guard demonstration -----------------------------------------
// Uncommenting the next line is a COMPILE error:
//   "Humanitas: cannot send — missing required field(s): body"
//
// Humanitas.enrollment.submit().channel("WEB").send()
// ----------------------------------------------------------------------------

export const main = (): Promise<unknown> =>
  Humanitas.run(enroll, {
    baseUrl: "https://api.humana.com",
    tokenUrl: "https://oauth.humana.com/oauth2/token",
    clientId: "REPLACE_ME",
    clientSecret: "REPLACE_ME",
    apiKey: "REPLACE_ME",
  })

// --- FHIR call: public provider directory (NO credentials needed) ------------
export const findProviders = (): Promise<unknown> =>
  Humanitas.run(
    Humanitas.fhir.directory
      .practitioner({ name: "smith", _count: 5 })
      .pipe(Effect.tap((b) => Effect.log(`found ${b.total ?? b.entry?.length ?? 0}`))),
    {
      // baseUrl/tokenUrl/clientId/secret/apiKey are unused by the public
      // directory call, but the config shape requires them.
      baseUrl: "https://api.humana.com",
      tokenUrl: "https://oauth.humana.com/oauth2/token",
      clientId: "",
      clientSecret: "",
      apiKey: "",
      fhirBaseUrl: "https://fhir.humana.com/api",
    },
  )

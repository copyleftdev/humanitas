/**
 * Agents API resource client (generic, over the generated `paths` type).
 *
 * All endpoints are keyed by a Sales Agent Number (SAN). Branding the SAN means
 * you cannot accidentally pass, say, an `EnrollmentId` here.
 */
import { api } from "../core/typed.js"
import type { AgentSan, Fips } from "../core/brand.js"
import type { paths } from "../generated/agent.js"

const call = api<paths>()

export const agent = {
  /** Core agent record for a SAN. */
  get: (san: AgentSan) => call("/{san}", "get", { path: { san } }),

  /** Plans an agent may sell in a county, as of a date (AOA). */
  plans: (
    san: AgentSan,
    query: { fips: Fips; state: string; as_of_date: string },
  ) =>
    call("/{san}/plans", "get", {
      path: { san },
      query,
    }),

  /** All plans associated with an agent. */
  allPlans: (san: AgentSan) =>
    call("/{san}/all-plans", "get", { path: { san } }),

  /** Agent certifications. */
  certifications: (san: AgentSan) =>
    call("/{san}/certifications", "get", { path: { san } }),

  /** Agent licenses. */
  licenses: (san: AgentSan) =>
    call("/{san}/licenses", "get", { path: { san } }),
}

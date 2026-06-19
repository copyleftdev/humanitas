/**
 * Plan Info API V2 resource client (generic, OpenAPI 3.0 source).
 *
 * Query parameters are inferred from the generated `paths` type, so required
 * search criteria (e.g. `fips` on Medicare plans, the full demographic set on
 * Medicare-supplement quotes) are enforced at compile time.
 */
import { api } from "../core/typed.js"
import type { PlanCode } from "../core/brand.js"
import type { paths } from "../generated/planInformation.js"

const call = api<paths>()

type Query<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  parameters: { query?: infer Q }
}
  ? Q
  : never

type Body<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer R
}
  ? NonNullable<R> extends { content: { "application/json": infer C } }
    ? C
    : unknown
  : unknown

export const planInformation = {
  /** IDV (individual dental/vision) plans, filtered. */
  idvPlans: (query?: Query<"/idv/plans", "get">) =>
    call("/idv/plans", "get", { query }),

  /** Run the rate calculator for an IDV plan. */
  rateCalculator: (
    planCode: PlanCode,
    body: Body<"/idv/plans/{planCode}/rate-calculator", "post">,
  ) =>
    call("/idv/plans/{planCode}/rate-calculator", "post", {
      path: { planCode },
      body,
    }),

  /** Medicare Advantage / PDP plans for a county (`fips` required). */
  medicarePlans: (query: NonNullable<Query<"/medicare/plans", "get">>) =>
    call("/medicare/plans", "get", { query }),

  /** Off-exchange benefit summaries (`customerNumber` + `benefitSequenceNumber`). */
  osbs: (query: NonNullable<Query<"/osbs", "get">>) =>
    call("/osbs", "get", { query }),

  /** Medicare-supplement plans for a ZIP + FIPS. */
  medicareSupplementPlans: (
    query: NonNullable<Query<"/medicare-supplement/plans", "get">>,
  ) => call("/medicare-supplement/plans", "get", { query }),

  /** Medicare-supplement rate quotes for a full applicant profile. */
  medicareSupplementQuotes: (
    query: NonNullable<Query<"/medicare-supplement/quotes", "get">>,
  ) => call("/medicare-supplement/quotes", "get", { query }),
}

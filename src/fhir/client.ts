/**
 * FHIR R4 resource client for `fhir.humana.com/api`.
 *
 * Humana's FHIR surface has two access tiers, and this client makes the
 * distinction explicit in its types:
 *
 *   - `directory` — the Da Vinci PDEX Plan-Net provider directory
 *     (Practitioner, Organization, Location, InsurancePlan, PractitionerRole).
 *     Public; no token. These calls require only {@link FhirContext}.
 *
 *   - `clinical` — PHI resources (Patient, Coverage, ExplanationOfBenefit, ...).
 *     SMART-on-FHIR gated; the server answers tokenless callers with
 *     401 "Invalid access token". Every method here *requires* a caller-supplied
 *     bearer (obtained via the SMART authorize/token endpoints in the
 *     CapabilityStatement), so you cannot forget it.
 */
import { Effect, type Redacted } from "effect"
import { fhirRequest, type FhirContext } from "../core/http.js"
import type { HumanitasError } from "../core/errors.js"
import type { ResourceId } from "../core/brand.js"
import { Bundle, CapabilityStatement, Resource } from "./schema.js"

type SearchParams = Record<string, string | number | boolean | undefined>

const toQuery = (q: SearchParams | undefined): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(q ?? {})) {
    out[k] = v === undefined ? undefined : String(v)
  }
  return out
}

/** A public (tokenless) directory search. */
const directorySearch = (
  type: string,
  params?: SearchParams,
): Effect.Effect<Bundle, HumanitasError, FhirContext> =>
  fhirRequest({
    method: "GET",
    path: `/${type}`,
    query: toQuery(params),
    response: Bundle,
  })

/** A public (tokenless) directory read by id. */
const directoryRead = (
  type: string,
  id: ResourceId,
): Effect.Effect<Resource, HumanitasError, FhirContext> =>
  fhirRequest({
    method: "GET",
    path: `/${type}/${id}`,
    response: Resource,
  })

/** A SMART-gated clinical search; the bearer is mandatory. */
const clinicalSearch = (
  type: string,
  token: Redacted.Redacted<string>,
  params?: SearchParams,
): Effect.Effect<Bundle, HumanitasError, FhirContext> =>
  fhirRequest({
    method: "GET",
    path: `/${type}`,
    query: toQuery(params),
    token,
    response: Bundle,
  })

/** A SMART-gated clinical read by id; the bearer is mandatory. */
const clinicalRead = (
  type: string,
  id: ResourceId,
  token: Redacted.Redacted<string>,
): Effect.Effect<Resource, HumanitasError, FhirContext> =>
  fhirRequest({
    method: "GET",
    path: `/${type}/${id}`,
    token,
    response: Resource,
  })

export const fhir = {
  /** Fetch the server CapabilityStatement (`/metadata`). Public. */
  metadata: (): Effect.Effect<CapabilityStatement, HumanitasError, FhirContext> =>
    fhirRequest({
      method: "GET",
      path: "/metadata",
      response: CapabilityStatement,
    }),

  /** The public Da Vinci PDEX Plan-Net provider directory (no token). */
  directory: {
    practitioner: (params?: SearchParams) => directorySearch("Practitioner", params),
    practitionerRole: (params?: SearchParams) =>
      directorySearch("PractitionerRole", params),
    organization: (params?: SearchParams) => directorySearch("Organization", params),
    location: (params?: SearchParams) => directorySearch("Location", params),
    insurancePlan: (params?: SearchParams) => directorySearch("InsurancePlan", params),
    read: (type: string, id: ResourceId) => directoryRead(type, id),
  },

  /** SMART-gated PHI resources — every method requires a bearer token. */
  clinical: {
    patient: (id: ResourceId, token: Redacted.Redacted<string>) =>
      clinicalRead("Patient", id, token),
    coverage: (token: Redacted.Redacted<string>, params?: SearchParams) =>
      clinicalSearch("Coverage", token, params),
    explanationOfBenefit: (
      token: Redacted.Redacted<string>,
      params?: SearchParams,
    ) => clinicalSearch("ExplanationOfBenefit", token, params),
    search: (type: string, token: Redacted.Redacted<string>, params?: SearchParams) =>
      clinicalSearch(type, token, params),
    read: (type: string, id: ResourceId, token: Redacted.Redacted<string>) =>
      clinicalRead(type, id, token),
  },
}

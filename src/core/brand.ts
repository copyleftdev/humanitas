/**
 * Branded primitive types.
 *
 * Humana's Data Exchange APIs traffic in a dozen different "string ids" — agent
 * sales numbers (SAN), enrollment ids, partner ids, group ids, plan codes,
 * FHIR logical ids, FIPS codes. At runtime they are all `string`; at the type
 * level they must never be interchangeable. We nominally brand each one so the
 * compiler rejects passing an `EnrollmentId` where an `AgentSan` is expected —
 * a whole class of integration bugs erased before the code ever runs.
 */
import { Brand } from "effect"

/**
 * A Sales Agent Number — the `{san}` path param on the Agents API.
 * The spec types it as an integer, but it is carried in the URL as a string;
 * we brand it and require it to be all digits.
 */
export type AgentSan = string & Brand.Brand<"AgentSan">
export const AgentSan = Brand.refined<AgentSan>(
  (s) => /^\d+$/.test(s),
  (s) => Brand.error(`AgentSan must be all digits, received "${s}"`),
)

/** An enrollment id (the `{enrollment_id}` path param on Medicare Enrollment). */
export type EnrollmentId = string & Brand.Brand<"EnrollmentId">
export const EnrollmentId = Brand.refined<EnrollmentId>(
  (s) => s.length > 0,
  (s) => Brand.error(`EnrollmentId must be non-empty, received "${s}"`),
)

/** A partner id (Small Groups Book of Business `{partner_id}`). */
export type PartnerId = string & Brand.Brand<"PartnerId">
export const PartnerId = Brand.nominal<PartnerId>()

/** A group id (Small Groups Book of Business `{group_id}`). */
export type GroupId = string & Brand.Brand<"GroupId">
export const GroupId = Brand.nominal<GroupId>()

/** A plan code (Plan Info `{planCode}`). */
export type PlanCode = string & Brand.Brand<"PlanCode">
export const PlanCode = Brand.nominal<PlanCode>()

/** A 5-digit FIPS county code (Agents AOA plans, Plan Info searches). */
export type Fips = string & Brand.Brand<"Fips">
export const Fips = Brand.refined<Fips>(
  (s) => /^\d{5}$/.test(s),
  (s) => Brand.error(`Fips must be a 5-digit county code, received "${s}"`),
)

/** A FHIR resource logical id (the `{id}` on a FHIR read). */
export type ResourceId = string & Brand.Brand<"ResourceId">
export const ResourceId = Brand.nominal<ResourceId>()

/**
 * Convenience: brand a literal at a call-site without ceremony.
 * `brand(AgentSan, "12345")` throws on invalid input — use the smart
 * constructor's `.either`/`.option` variants when you need to handle failure
 * as a value.
 */
export const brand = <A extends Brand.Brand<any>>(
  ctor: Brand.Brand.Constructor<A>,
  value: Brand.Brand.Unbranded<A>,
): A => ctor(value)

/**
 * Minimal FHIR R4 schema fragments.
 *
 * The Humana FHIR server (Firely Server, R4 4.0.1) returns full FHIR resources
 * and `searchset` Bundles. We decode the envelope (resourceType, id, Bundle
 * paging + entries) and leave individual resource bodies as `Unknown` — callers
 * that need a specific resource shape can narrow on `resourceType`.
 */
import { Schema } from "effect"

/** A FHIR resource, minimally typed by its `resourceType`. */
export const Resource = Schema.Struct({
  resourceType: Schema.String,
  id: Schema.optional(Schema.String),
}).pipe(Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown })))
export type Resource = Schema.Schema.Type<typeof Resource>

/** A Bundle.link entry (pagination: `self`, `next`, ...). */
const BundleLink = Schema.Struct({
  relation: Schema.String,
  url: Schema.String,
})

/** A Bundle.entry. */
const BundleEntry = Schema.Struct({
  fullUrl: Schema.optional(Schema.String),
  resource: Schema.optional(Resource),
})

/** A FHIR searchset Bundle. */
export const Bundle = Schema.Struct({
  resourceType: Schema.Literal("Bundle"),
  type: Schema.optional(Schema.String),
  total: Schema.optional(Schema.Number),
  link: Schema.optional(Schema.Array(BundleLink)),
  entry: Schema.optional(Schema.Array(BundleEntry)),
})
export type Bundle = Schema.Schema.Type<typeof Bundle>

/** The CapabilityStatement (returned by `/metadata`); decoded loosely. */
export const CapabilityStatement = Schema.Struct({
  resourceType: Schema.Literal("CapabilityStatement"),
  fhirVersion: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
}).pipe(Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown })))
export type CapabilityStatement = Schema.Schema.Type<typeof CapabilityStatement>

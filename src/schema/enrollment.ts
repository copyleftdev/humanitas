/**
 * Medicare Enrollment API — schemas.
 *
 * Modeled from the published `enrollment-api-spec.json` (`components/schemas/
 * application`). This is a faithful, hand-curated subset of the full intake
 * contract: the request carries PII/PHI (SSN, Medicare claim number, date of
 * birth) and a structured chronic-condition questionnaire. Fields marked
 * required here mirror the spec's `required` arrays; optional clinical detail
 * is modeled loosely (`Schema.Record`) so the SDK never rejects a server-valid
 * payload it merely hasn't enumerated.
 */
import { Schema } from "effect"
import { Address, PhoneType } from "./common.js"

/** Enrollment.Gender — enumerated `male | female`. */
export const Gender = Schema.Literal("male", "female")
export type Gender = Schema.Schema.Type<typeof Gender>

/** The selling agent attached to an application. */
export const Agent = Schema.Struct({
  agent_name: Schema.String,
  agent_san: Schema.Number,
  agent_email_address: Schema.optional(Schema.String),
  notify_when_digitally_signed: Schema.optional(Schema.Boolean),
})
export type Agent = Schema.Schema.Type<typeof Agent>

/**
 * The applicant's chronic-condition questionnaire. The spec nests a fixed set
 * of conditions (cardiovascular, chronic heart failure, chronic lung disease,
 * diabetes, end-stage renal disease), each a small object of yes/no answers and
 * medications. We model the answers loosely to stay forward-compatible.
 */
const ConditionAnswers = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})

export const ChronicConditions = Schema.Struct({
  cardiovascular_disease: Schema.optional(ConditionAnswers),
  chronic_heart_failure: Schema.optional(ConditionAnswers),
  chronic_lung_disease: Schema.optional(ConditionAnswers),
  diabetes: Schema.optional(ConditionAnswers),
  end_stage_renal_disease: Schema.optional(ConditionAnswers),
})
export type ChronicConditions = Schema.Schema.Type<typeof ChronicConditions>

/** Enrollment.applicant — the human being enrolled. */
export const Applicant = Schema.Struct({
  first_name: Schema.String,
  middle_initial: Schema.optional(Schema.String),
  last_name: Schema.String,
  date_of_birth: Schema.String,
  gender: Gender,
  /** Medicare Beneficiary Identifier / claim number — PHI. */
  medicare_claim_number: Schema.String,
  hospital_insurance_parta: Schema.String,
  medical_insurance_partb: Schema.String,
  ssn: Schema.optional(Schema.String),
  email_address: Schema.optional(Schema.String),
  phone_number: Schema.String,
  phone_type: Schema.optional(PhoneType),
  permanent_address: Address,
  mailing_address: Schema.optional(Address),
  language_preference: Schema.optional(Schema.String),
  alternate_language_format: Schema.optional(Schema.String),
  chronic_conditions: Schema.optional(ChronicConditions),
})
export type Applicant = Schema.Schema.Type<typeof Applicant>

/** Enrollment.emergency_contact. */
export const EmergencyContact = Schema.Struct({
  first_name: Schema.String,
  middle_initial: Schema.optional(Schema.String),
  last_name: Schema.String,
  phone_number: Schema.String,
  relationship: Schema.String,
})
export type EmergencyContact = Schema.Schema.Type<typeof EmergencyContact>

/** Enrollment.application — the `POST /enrollment` request body. */
export const Application = Schema.Struct({
  agent: Agent,
  applicant: Applicant,
  application_date: Schema.optional(Schema.String),
  do_you_or_your_spouse_work: Schema.optional(Schema.Boolean),
  emergency_contact: Schema.optional(EmergencyContact),
})
export type Application = Schema.Schema.Type<typeof Application>

/** The submit response — an enrollment id plus a status. */
export const EnrollmentResponse = Schema.Struct({
  enrollment_id: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  confirmation_number: Schema.optional(Schema.String),
})
export type EnrollmentResponse = Schema.Schema.Type<typeof EnrollmentResponse>

/** The `GET /enrollment/{id}/status` response. */
export const EnrollmentStatus = Schema.Struct({
  enrollment_id: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  status_date: Schema.optional(Schema.String),
})
export type EnrollmentStatus = Schema.Schema.Type<typeof EnrollmentStatus>

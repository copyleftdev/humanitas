/**
 * Medicare Enrollment resource client.
 *
 * Showcases the type-state submit builder: `.send()` is only callable once the
 * application body has been supplied. The selling channel (`x-channel-code` /
 * `x-channel-id`) is optional and threaded through as request headers.
 *
 *   enrollment.submit().body(app).send()                 // ✓ compiles
 *   enrollment.submit().channel("WEB", "abc").send()     // ✗ missing body
 */
import { Effect, Schema } from "effect"
import type { EnrollmentId } from "../core/brand.js"
import { request, type RequestContext } from "../core/http.js"
import {
  type CarriesProvided,
  ProvidedFields,
  type WhenComplete,
} from "../core/request-builder.js"
import type { HumanitasError } from "../core/errors.js"
import * as E from "../schema/enrollment.js"

type SubmitField = "body"
type SubmitRequired = "body"

interface SubmitValues {
  body?: E.Application
  channelCode?: string
  channelId?: string
}

const encodeApplication = Schema.encodeSync(E.Application)

/**
 * Fluent, type-state request builder for `POST /enrollment`. `body()` widens the
 * phantom `Provided` union; `send()` is gated on the application being present.
 */
export class EnrollmentSubmitBuilder<Provided extends SubmitField = never>
  implements CarriesProvided<Provided>
{
  declare readonly [ProvidedFields]?: Provided
  private constructor(private readonly values: SubmitValues) {}

  /** @internal */
  static start(): EnrollmentSubmitBuilder<never> {
    return new EnrollmentSubmitBuilder({})
  }

  /** Provide the Medicare enrollment application (PII/PHI payload). */
  body(application: E.Application): EnrollmentSubmitBuilder<Provided | "body"> {
    return new EnrollmentSubmitBuilder({
      ...this.values,
      body: application,
    }) as EnrollmentSubmitBuilder<Provided | "body">
  }

  /** Optionally tag the originating sales channel. */
  channel(code: string, id?: string): EnrollmentSubmitBuilder<Provided> {
    return new EnrollmentSubmitBuilder({
      ...this.values,
      channelCode: code,
      channelId: id,
    }) as EnrollmentSubmitBuilder<Provided>
  }

  send(
    this: WhenComplete<EnrollmentSubmitBuilder<Provided>, SubmitRequired, Provided>,
  ): Effect.Effect<E.EnrollmentResponse, HumanitasError, RequestContext> {
    const self = this as unknown as EnrollmentSubmitBuilder<SubmitRequired>
    const v = self.values
    const headers: Record<string, string> = {}
    if (v.channelCode !== undefined) headers["x-channel-code"] = v.channelCode
    if (v.channelId !== undefined) headers["x-channel-id"] = v.channelId
    return request({
      method: "POST",
      path: "/enrollment",
      headers,
      body: encodeApplication(v.body!),
      response: E.EnrollmentResponse,
    })
  }
}

export interface EnrollmentResource {
  /** Begin a type-state Medicare enrollment submission. */
  readonly submit: () => EnrollmentSubmitBuilder<never>
  /** Look up the status of a prior submission. */
  readonly status: (args: {
    readonly enrollmentId: EnrollmentId
  }) => Effect.Effect<E.EnrollmentStatus, HumanitasError, RequestContext>
  /** Record the member's pharmacy-consent decision for an enrollment. */
  readonly pharmacyConsent: (args: {
    readonly enrollmentId: EnrollmentId
    readonly body: unknown
  }) => Effect.Effect<unknown, HumanitasError, RequestContext>
}

export const enrollment: EnrollmentResource = {
  submit: () => EnrollmentSubmitBuilder.start(),
  status: ({ enrollmentId }) =>
    request({
      method: "GET",
      path: `/enrollment/${enrollmentId}/status`,
      response: E.EnrollmentStatus,
    }),
  pharmacyConsent: ({ enrollmentId, body }) =>
    request({
      method: "POST",
      path: `/enrollment/${enrollmentId}/pharmacy-consent`,
      body,
      response: Schema.Unknown,
    }),
}

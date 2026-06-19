/**
 * Enrollment Reporting V1 resource client (generic).
 *
 * Two Medicare reporting feeds: BAM (Batch Application Membership) and APED.
 */
import { api } from "../core/typed.js"
import type { paths } from "../generated/enrollmentReporting.js"

const call = api<paths>()

type Body<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer R
}
  ? NonNullable<R> extends { content: { "application/json": infer C } }
    ? C
    : unknown
  : unknown

export const enrollmentReporting = {
  /** Batch Application Membership report. */
  bam: (body: Body<"/medicare/bam", "post">) =>
    call("/medicare/bam", "post", { body: body as never }),

  /** APED report. */
  aped: (body: Body<"/medicare/aped", "post">) =>
    call("/medicare/aped", "post", { body: body as never }),
}

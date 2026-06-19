/**
 * IDV Enrollment resource client (generic).
 *
 * NOTE: the published spec declares this API on the production host
 * (`api.humana.com`), unlike its QA-hosted siblings — supply production
 * credentials accordingly.
 */
import { api } from "../core/typed.js"
import type { paths } from "../generated/idvEnrollment.js"

const call = api<paths>()

/** The inferred `POST /enrollment` request body. */
export type IdvEnrollmentBody = NonNullable<
  paths["/enrollment"]["post"]["requestBody"]
>["content"]["application/json"]

export const idvEnrollment = {
  /** Submit an individual dental/vision enrollment. */
  submit: (body: IdvEnrollmentBody) =>
    call("/enrollment", "post", { body }),
}

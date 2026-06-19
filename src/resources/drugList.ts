/**
 * Drug List API resource client (generic).
 *
 * Saves a member's prospective drug list (`POST /savedruglist`).
 */
import { api } from "../core/typed.js"
import type { paths } from "../generated/drugList.js"

const call = api<paths>()

/** The inferred `POST /savedruglist` request body. */
export type DrugListBody = NonNullable<
  paths["/savedruglist"]["post"]["requestBody"]
>["content"]["application/json"]

export const drugList = {
  /** Persist a member's drug list. */
  save: (body: DrugListBody) => call("/savedruglist", "post", { body }),
}

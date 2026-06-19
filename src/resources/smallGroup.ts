/**
 * Small Groups Book of Business resource client (generic).
 */
import { api } from "../core/typed.js"
import type { GroupId, PartnerId } from "../core/brand.js"
import type { paths } from "../generated/smallGroup.js"

const call = api<paths>()

export const smallGroup = {
  /** A partner's full book of business. */
  bob: (partnerId: PartnerId) =>
    call("/partners/{partner_id}/bob", "get", {
      path: { partner_id: partnerId },
    }),

  /** A single group within a partner's book of business. */
  group: (partnerId: PartnerId, groupId: GroupId) =>
    call("/partners/{partner_id}/bob/{group_id}", "get", {
      path: { partner_id: partnerId, group_id: groupId },
    }),
}

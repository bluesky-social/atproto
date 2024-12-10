import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import { RefreshPurchasesResponse } from '../proto/bsync_pb'
import AppContext from '../context'
import { authWithApiKey } from './auth'
import { isValidDid } from './util'
import { addPurchaseOperation } from '../purchases/addPurchaseOperation'
import { PurchaseItem } from '../db/schema/purchase_item'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async refreshPurchases(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)

    const { db, purchasesClient } = ctx
    if (!purchasesClient) {
      throw new ConnectError(
        'PurchasesClient is not configured on bsync',
        Code.Unimplemented,
      )
    }

    const { actorDid } = req
    if (!isValidDid(actorDid)) {
      throw new ConnectError(
        'actor_did must be a valid did',
        Code.InvalidArgument,
      )
    }

    const newEntitlements = await purchasesClient.getEntitlements(actorDid)

    const purchaseItem = await db.db
      .selectFrom('purchase_item')
      .selectAll()
      .where('actorDid', '=', actorDid)
      .executeTakeFirst()
    const oldEntitlements = purchaseItem ? purchaseItem.entitlements : []

    if (!purchaseItem || !entitlementsMatch(oldEntitlements, newEntitlements)) {
      await addPurchaseOperation(db, actorDid, newEntitlements)
    }

    return new RefreshPurchasesResponse()
  },
})

const entitlementsMatch = (
  oldEntitlements: string[],
  newEntitlements: string[],
) => {
  // oldEntitlements were stored sorted, so we need to sort newEntitlements to compare
  const sortedNewEntitlements = [...newEntitlements].sort()
  return (
    oldEntitlements.length === sortedNewEntitlements.length &&
    oldEntitlements.every((value, index) => {
      return value === sortedNewEntitlements[index]
    })
  )
}

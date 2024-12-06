import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import { AddPurchaseOperationResponse } from '../proto/bsync_pb'
import AppContext from '../context'
import { authWithApiKey } from './auth'
import { isValidDid } from './util'
import { addPurchaseOperation } from '../purchases/addPurchaseOperation'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async addPurchaseOperation(req, handlerCtx) {
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

    const entitlements = await purchasesClient.getEntitlements(actorDid)

    await addPurchaseOperation(db, actorDid, entitlements)

    return new AddPurchaseOperationResponse()
  },
})

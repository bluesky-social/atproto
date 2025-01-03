import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import { GetSubscriptionsResponse } from '../proto/bsync_pb'
import AppContext from '../context'
import { authWithApiKey } from './auth'
import { isValidDid } from './util'
import { httpLogger } from '../logger'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async getSubscriptions(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)

    const { purchasesClient } = ctx
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

    const { email, subscriptions } =
      await purchasesClient.getSubscriptionsAndEmail(actorDid)

    if (!email) {
      httpLogger.warn(
        { actorDid },
        `getSubscriptions didn't get email for user`,
      )
    }

    return new GetSubscriptionsResponse({
      email,
      subscriptions,
    })
  },
})

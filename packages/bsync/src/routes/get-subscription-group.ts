import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import { GetSubscriptionGroupResponse } from '../proto/bsync_pb'
import AppContext from '../context'
import { authWithApiKey } from './auth'
import { assertPlatform, assertSubscriptionGroup } from '../purchases'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async getSubscriptionGroup(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)

    const { purchasesClient } = ctx
    if (!purchasesClient) {
      throw new ConnectError(
        'PurchasesClient is not configured on bsync',
        Code.Unimplemented,
      )
    }

    const { group, platform } = req
    try {
      assertSubscriptionGroup(group)
      assertPlatform(platform)
    } catch (error) {
      throw new ConnectError((error as Error).message, Code.InvalidArgument)
    }

    const offerings = purchasesClient.getSubscriptionGroup(group, platform)

    return new GetSubscriptionGroupResponse({
      offerings,
    })
  },
})

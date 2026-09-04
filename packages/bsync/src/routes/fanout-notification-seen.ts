import { Code, ConnectError, type ServiceImpl } from '@connectrpc/connect'
import type { AppContext } from '../context.js'
import { httpLogger } from '../logger.js'
import type { Service } from '../proto/bsync_connect.js'
import { authWithApiKey } from './auth.js'
import { isValidDid } from './util.js'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async fanoutNotificationSeen(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { actorDid, timestamp } = req
    if (!isValidDid(actorDid)) {
      throw new ConnectError(
        'actor_did must be a valid did',
        Code.InvalidArgument,
      )
    }
    if (!timestamp) {
      throw new ConnectError('timestamp is required', Code.InvalidArgument)
    }
    if (ctx.dataplaneClients.length === 0) {
      httpLogger.warn('no dataplane clients configured')
      return {}
    }

    const results = await Promise.allSettled(
      ctx.dataplaneClients.map((client) =>
        client.updateNotificationSeen({ actorDid, timestamp }),
      ),
    )
    if (results.every((result) => result.status === 'rejected')) {
      throw new ConnectError('all dataplane updates failed', Code.Unavailable)
    }
    return {}
  },
})

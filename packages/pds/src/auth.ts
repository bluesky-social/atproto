import { combine } from '@atproto/http-util'

import AppContext from './context'
import { oauthLogger } from './logger'

export const createRouter = (ctx: AppContext) => {
  return combine([
    ctx.oauthProvider?.httpHandler({
      // Log oauth provider errors using our own logger
      onError: (req, res, err) => {
        oauthLogger.error({ err }, 'oauth-provider error')
      },
    }),
  ])
}

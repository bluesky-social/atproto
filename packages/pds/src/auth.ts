import { combine } from '@atproto/http-util'

import AppContext from './context'
import { oauthLogger } from './logger'

export const createRouter = (ctx: AppContext) => {
  return combine([
    ctx.oauthProvider?.httpHandler({
      // TODO: This must come from config
      branding: {
        name: 'My PDS',
        logo: 'https://uxwing.com/wp-content/themes/uxwing/download/animals-and-birds/bee-icon.png',
        colors: {
          primary: '#ffcb1e', // #0085ff
        },
      },
      // Log oauth provider errors using our own logger
      onError: (req, res, err) => {
        oauthLogger.error({ err }, 'oauth-provider error')
      },
    }),
  ])
}

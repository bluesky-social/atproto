import type { IncomingMessage, ServerResponse } from 'node:http'
import { asHandler, combineMiddlewares } from './lib/http/middleware.js'
import { Handler } from './lib/http/types.js'
import { OAuthProvider } from './oauth-provider.js'
import { apiRouter } from './router/api-router.js'
import { authorizeRouter } from './router/authorize-router.js'
import { oauthRouter } from './router/oauth-router.js'
import { RouterOptions } from './router/router-options.js'

export { type Handler, type RouterOptions }

/**
 * @returns An http request handler that can be used with node's http server
 * or as a middleware with express / connect.
 */
export function oauthMiddleware<
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  { ...options }: RouterOptions<Req, Res> = {},
): Handler<void, Req, Res> {
  // options is a shallow cloned so it's fine to mutate it
  options.onError ??=
    process.env['NODE_ENV'] === 'development'
      ? (req, res, err, msg) => {
          console.error(`OAuthProvider error (${msg}):`, err)
        }
      : undefined

  return asHandler(
    combineMiddlewares([
      oauthRouter(server, options).buildMiddleware(),
      authorizeRouter(server, options).buildMiddleware(),
      apiRouter(server, options).buildMiddleware(),
    ]),
  )
}

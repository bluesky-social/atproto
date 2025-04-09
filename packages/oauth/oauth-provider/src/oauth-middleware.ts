import type { IncomingMessage, ServerResponse } from 'node:http'
import { asHandler, combineMiddlewares } from './lib/http/middleware.js'
import { Handler } from './lib/http/types.js'
import { OAuthProvider } from './oauth-provider.js'
import { apiRouter } from './router/api-router.js'
import { ErrorHandler } from './router/error-handler.js'
import { oauthRouter } from './router/oauth-router.js'
import { RouterOptions } from './router/router-options.js'
import { authorizeRouter } from './router/ui-router.js'

// Export all the types exposed
export type {
  ErrorHandler,
  Handler,
  IncomingMessage,
  RouterOptions,
  ServerResponse,
}

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
  const { onError } = options

  // options is shallow cloned so it's fine to mutate it
  options.onError =
    process.env['NODE_ENV'] === 'development'
      ? (req, res, err, msg) => {
          console.error(`OAuthProvider error (${msg}):`, err)
          return onError?.(req, res, err, msg)
        }
      : onError

  return asHandler(
    combineMiddlewares([
      oauthRouter(server, options).buildMiddleware(),
      apiRouter(server, options).buildMiddleware(),
      authorizeRouter(server, options).buildMiddleware(),
    ]),
  )
}

import type { IncomingMessage, ServerResponse } from 'node:http'
import { asHandler, combineMiddlewares } from './lib/http/middleware.js'
import { Handler } from './lib/http/types.js'
import { OAuthProvider } from './oauth-provider.js'
import { assetsMiddleware } from './router/assets/assets.js'
import { createAccountPageMiddleware } from './router/create-account-page-middleware.js'
import { createApiMiddleware } from './router/create-api-middleware.js'
import { createAuthorizationPageMiddleware } from './router/create-authorization-page-middleware.js'
import { createOAuthMiddleware } from './router/create-oauth-middleware.js'
import { ErrorHandler } from './router/error-handler.js'
import { MiddlewareOptions } from './router/middleware-options.js'

// Export all the types exposed
export type {
  ErrorHandler,
  Handler,
  IncomingMessage,
  MiddlewareOptions,
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
  { ...options }: MiddlewareOptions<Req, Res> = {},
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
      assetsMiddleware,
      createOAuthMiddleware(server, options),
      createApiMiddleware(server, options),
      createAuthorizationPageMiddleware(server, options),
      createAccountPageMiddleware(server, options),
    ]),
  )
}

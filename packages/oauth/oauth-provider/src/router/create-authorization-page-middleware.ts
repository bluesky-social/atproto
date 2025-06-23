import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  oauthAuthorizationRequestQuerySchema,
  oauthClientCredentialsSchema,
} from '@atproto/oauth-types'
import { AuthorizationError } from '../errors/authorization-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import {
  Middleware,
  Router,
  RouterCtx,
  validateFetchDest,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferrer,
} from '../lib/http/index.js'
import { formatError } from '../lib/util/error.js'
import type { Awaitable } from '../lib/util/type.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { requestUriSchema } from '../request/request-uri.js'
import { AuthorizationResultRedirect } from '../result/authorization-result-redirect.js'
import { sendAuthorizePageFactory } from './assets/send-authorization-page.js'
import { sendErrorPageFactory } from './assets/send-error-page.js'
import { parseRedirectUrl } from './create-api-middleware.js'
import type { MiddlewareOptions } from './middleware-options.js'
import {
  buildRedirectMode,
  buildRedirectParams,
  buildRedirectUri,
  sendRedirect,
} from './send-redirect.js'

export function createAuthorizationPageMiddleware<
  Ctx extends object | void = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  { onError }: MiddlewareOptions<Req, Res>,
): Middleware<Ctx, Req, Res> {
  const sendAuthorizePage = sendAuthorizePageFactory(server.customization)
  const sendErrorPage = sendErrorPageFactory(server.customization)

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin

  const router = new Router<Ctx, Req, Res>(issuerUrl)

  router.get(
    '/oauth/authorize',
    withErrorHandler(async function (req, res) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      validateFetchSite(req, ['cross-site', 'none'])
      validateFetchMode(req, ['navigate'])
      validateFetchDest(req, ['document'])
      validateOrigin(req, issuerOrigin)

      const query = Object.fromEntries(this.url.searchParams)

      const clientCredentials = await oauthClientCredentialsSchema
        .parseAsync(query, { path: ['query'] })
        .catch((err) => throwInvalidRequest(err, 'Invalid client credentials'))

      if ('client_secret' in clientCredentials) {
        throw new InvalidRequestError('Client secret must not be provided')
      }

      const authorizationRequest = await oauthAuthorizationRequestQuerySchema
        .parseAsync(query, { path: ['query'] })
        .catch((err) => throwInvalidRequest(err, 'Invalid request parameters'))

      const deviceInfo = await server.deviceManager.load(req, res)

      try {
        const result = await server.authorize(
          clientCredentials,
          authorizationRequest,
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
        )

        if ('redirect' in result) {
          return sendAuthorizeRedirect(res, result)
        } else {
          return sendAuthorizePage(req, res, result)
        }
      } catch (err) {
        onError?.(req, res, err, 'Authorization request denied')

        if (err instanceof AuthorizationError) {
          try {
            return sendAuthorizeRedirect(res, {
              issuer: server.issuer,
              parameters: err.parameters,
              redirect: err.toJSON(),
            })
          } catch {
            // If we fail to send the redirect, we fall back to sending an error
          }
        }

        return sendErrorPage(req, res, err)
      }
    }),
  )

  // This is a private endpoint that will be called by the user after the
  // authorization request was either approved or denied. The logic performed
  // here **could** be performed directly in the frontend. We decided to
  // implement it here to avoid duplicating the logic.
  router.get(
    '/oauth/authorize/redirect',
    withErrorHandler(async function (req, res) {
      // Ensure we come from the authorization page
      validateFetchSite(req, ['same-origin'])
      validateFetchMode(req, ['navigate'])
      validateFetchDest(req, ['document'])
      validateOrigin(req, issuerOrigin)

      const referrer = validateReferrer(req, {
        origin: issuerOrigin,
        pathname: '/oauth/authorize',
      })

      // Ensure we are coming from the authorization page
      requestUriSchema.parse(referrer.searchParams.get('request_uri'))

      return sendRedirect(res, parseRedirectUrl(this.url))
    }),
  )

  return router.buildMiddleware()

  function withErrorHandler<T extends RouterCtx>(
    handler: (this: T, req: Req, res: Res) => Awaitable<void>,
  ): Middleware<T, Req, Res> {
    return async function (req, res) {
      try {
        await handler.call(this, req, res)
      } catch (err) {
        onError?.(
          req,
          res,
          err,
          `Failed to handle navigation request to "${req.url}"`,
        )

        if (!res.headersSent) {
          sendErrorPage(req, res, err)
        }
      }
    }
  }
}

function throwInvalidRequest(err: unknown, prefix: string): never {
  throw new InvalidRequestError(formatError(err, prefix), err)
}

function sendAuthorizeRedirect(
  res: ServerResponse,
  { issuer, parameters, redirect }: AuthorizationResultRedirect,
) {
  const redirectUri = buildRedirectUri(parameters)
  const mode = buildRedirectMode(parameters)
  const params = buildRedirectParams(issuer, parameters, redirect)
  return sendRedirect(res, { mode, redirectUri, params })
}

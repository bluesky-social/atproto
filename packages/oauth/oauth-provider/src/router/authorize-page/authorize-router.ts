import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  oauthAuthorizationRequestQuerySchema,
  oauthClientCredentialsSchema,
} from '@atproto/oauth-types'
import { AccessDeniedError } from '../../errors/access-denied-error.js'
import { InvalidRequestError } from '../../errors/invalid-request-error.js'
import {
  Middleware,
  Router,
  RouterCtx,
  validateFetchDest,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferer,
} from '../../lib/http/index.js'
import type { Awaitable } from '../../lib/util/type.js'
import { extractZodErrorMessage } from '../../lib/util/zod-error.js'
import type { OAuthProvider } from '../../oauth-provider.js'
import { requestUriSchema } from '../../request/request-uri.js'
import { AuthorizationResultRedirect } from '../../result/authorization-result-redirect.js'
import { parseRedirectUrl } from '../api-router.js'
import type { RouterOptions } from '../router-options.js'
import { assetsMiddleware } from './assets-middleware.js'
import { sendAuthorizePageFactory } from './send-authorize-page.js'
import { sendErrorPageFactory } from './send-error-page.js'
import {
  buildRedirectMode,
  buildRedirectParams,
  buildRedirectUri,
  sendRedirect,
} from './send-redirect.js'

export function authorizeRouter<
  T extends object | void = void,
  TReq extends IncomingMessage = IncomingMessage,
  TRes extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  options: RouterOptions<TReq, TRes>,
): Router<T, TReq, TRes> {
  const { onError } = options
  const sendAuthorizePage = sendAuthorizePageFactory(server.customization)
  const sendErrorPage = sendErrorPageFactory(server.customization)

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin

  const router = new Router<T, TReq, TRes>(issuerUrl)

  router.use(assetsMiddleware)

  router.get(
    '/oauth/authorize',
    buildNavigationMiddleware(async function (req, res) {
      validateFetchSite(req, ['cross-site', 'none'])

      const query = Object.fromEntries(this.url.searchParams)

      const clientCredentials = await oauthClientCredentialsSchema
        .parseAsync(query, { path: ['query'] })
        .catch(throwInvalidRequest)

      if ('client_secret' in clientCredentials) {
        throw new InvalidRequestError('Client secret must not be provided')
      }

      const authorizationRequest = await oauthAuthorizationRequestQuerySchema
        .parseAsync(query, { path: ['query'] })
        .catch(throwInvalidRequest)

      const deviceInfo = await server.deviceManager.load(req, res)

      try {
        const result = await server.authorize(
          clientCredentials,
          authorizationRequest,
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
        )

        if ('redirect' in result) {
          await sendAuthorizeRedirect(res, result)
        } else {
          await sendAuthorizePage(req, res, result)
        }
      } catch (err) {
        // If we have the "redirect_uri" parameter, we can redirect the user
        // to the client with an error.
        if (err instanceof AccessDeniedError && err.parameters.redirect_uri) {
          // Prefer logging the cause
          onError?.(req, res, err.cause ?? err, 'Authorization failed')

          return sendAuthorizeRedirect(res, {
            issuer: server.issuer,
            parameters: err.parameters,
            redirect: err.toJSON(),
          })
        }

        throw err
      }
    }),
  )

  // This is a private endpoint that will be called by the user after the
  // authorization request was either approved or denied. The logic performed
  // here **could** be performed directly in the frontend. We decided to
  // implement it here to avoid duplicating the logic.
  router.get(
    '/oauth/authorize/redirect',
    buildNavigationMiddleware(async function (req, res) {
      // Ensure we come from the authorization page
      validateFetchSite(req, ['same-origin'])
      const referer = validateReferer(req, {
        origin: issuerOrigin,
        pathname: '/oauth/authorize',
      })

      // Ensure we are coming from the authorization page
      requestUriSchema.parse(referer.searchParams.get('request_uri'))

      await sendRedirect(res, parseRedirectUrl(this.url))
    }),
  )

  return router

  function buildNavigationMiddleware<T extends RouterCtx>(
    handler: (this: T, req: TReq, res: TRes) => Awaitable<void>,
  ): Middleware<T, TReq, TRes> {
    return async function (req, res, next) {
      res.setHeader('Referrer-Policy', 'same-origin')

      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      try {
        validateFetchMode(req, ['navigate'])
        validateFetchDest(req, ['document'])
        validateOrigin(req, issuerOrigin)

        await handler.call(this, req, res)
      } catch (err) {
        try {
          if (res.headersSent) throw err

          onError?.(
            req,
            res,
            err,
            `Failed to handle navigation request to "${req.url}"`,
          )

          // Display the error to the user
          await sendErrorPage(req, res, err)
        } catch (err) {
          next(err)
        }
      }
    }
  }
}

function throwInvalidRequest(err: unknown): never {
  throw new InvalidRequestError(
    extractZodErrorMessage(err) ?? 'Input validation error',
    err,
  )
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

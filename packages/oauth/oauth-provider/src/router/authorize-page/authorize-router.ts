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
  SubCtx,
  subCtx,
  validateFetchDest,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferer,
} from '../../lib/http/index.js'
import { RouteCtx, createRoute } from '../../lib/http/route.js'
import type { Awaitable } from '../../lib/util/type.js'
import { extractZodErrorMessage } from '../../lib/util/zod-error.js'
import type {
  AuthorizationResultRedirect,
  OAuthProvider,
} from '../../oauth-provider.js'
import { RequestUri, requestUriSchema } from '../../request/request-uri.js'
import { clearSessionCookies } from '../api-router.js'
import { validateCsrfToken } from '../csrf.js'
import type { RouterOptions } from '../router-options.js'
import { assetsMiddleware } from './assets-middleware.js'
import { sendAuthorizePageFactory } from './send-authorize-page.js'
import { sendAuthorizeRedirect } from './send-authorize-redirect.js'
import { sendErrorPageFactory } from './send-error-page.js'

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

      const result = await server
        .authorize(
          clientCredentials,
          authorizationRequest,
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
        )
        .catch((err) => accessDeniedToRedirectCatcher(req, res, err))

      if ('redirect' in result) {
        sendAuthorizeRedirect(req, res, result)
      } else {
        sendAuthorizePage(req, res, result)
      }
    }),
  )

  router.use(
    buildRedirectMiddleware('/accept', async function (req, res) {
      const sub = this.url.searchParams.get('account_sub')
      if (!sub) throw new InvalidRequestError('Account sub not provided')

      const deviceInfo = await server.deviceManager.load(req, res)

      return server
        .acceptRequest(
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
          this.requestUri,
          sub,
        )
        .catch((err) => accessDeniedToRedirectCatcher(req, res, err))
    }),
  )

  router.use(
    buildRedirectMiddleware('/reject', async function (req, res) {
      const deviceInfo = await server.deviceManager.load(req, res)

      return server
        .rejectRequest(
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
          this.requestUri,
        )
        .catch((err) => accessDeniedToRedirectCatcher(req, res, err))
    }),
  )

  return router

  function buildNavigationMiddleware<T extends RouterCtx>(
    middleware: Middleware<T, TReq, TRes>,
  ): Middleware<T, TReq, TRes> {
    return function (req, res, next) {
      res.setHeader('Referrer-Policy', 'same-origin')

      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      try {
        validateFetchMode(req, ['navigate'])
        validateFetchDest(req, ['document'])
        validateOrigin(req, issuerOrigin)
      } catch (err) {
        next(err)
        return
      }

      middleware.call(this, req, res, (err) => {
        try {
          if (!err || typeof err === 'string') {
            // A middleware wrapped with navigationHandler should always end the
            // request, either by calling "next" with an error or by sending a
            // response.
            throw new Error('Navigation handler should end the request')
          }

          // If the middleware called "next" with an error, let's display it in
          // an error page.

          onError?.(
            req,
            res,
            err,
            `Failed to handle navigation request to "${req.url}"`,
          )

          if (res.headersSent) return res.destroy()

          sendErrorPage(req, res, err)
        } catch (err) {
          next(err)
        }
      })
    }
  }

  // Simple GET requests fall under the category of "no-cors" request, meaning
  // that the browser will allow any cross-origin request, with credentials,
  // to be sent to the oauth server. The OAuth Server will, however:
  // 1) validate the request origin (see navigationHandler),
  // 2) validate the CSRF token,
  // 3) validate the referer,
  // 4) validate the sec-fetch-site header,
  // 4) validate the sec-fetch-mode header (see navigationHandler),
  // 5) validate the sec-fetch-dest header (see navigationHandler).
  // And will error (refuse to serve the request) if any of these checks fail.
  function buildRedirectMiddleware<T extends RouterCtx>(
    endpoint: '/accept' | '/reject',
    buildRedirect: (
      this: SubCtx<RouteCtx<T>, { requestUri: RequestUri }>,
      req: TReq,
      res: TRes,
    ) => Awaitable<AuthorizationResultRedirect>,
  ): Middleware<T, TReq, TRes> {
    return createRoute(
      'GET',
      `/oauth/authorize${endpoint}`,
      buildNavigationMiddleware(async function (req, res) {
        // Ensure that the user comes from a page on the same origin.
        validateFetchSite(req, ['same-origin'])

        const referer = validateReferer(req, {
          origin: issuerOrigin,
          pathname: '/oauth/authorize',
        })

        const requestUri = await requestUriSchema.parseAsync(
          referer.searchParams.get('request_uri'),
        )

        const csrfToken = this.url.searchParams.get('csrf_token')

        validateCsrfToken(req, csrfToken, requestUri)

        const context = subCtx(this, { requestUri })

        const redirect = await buildRedirect.call(context, req, res)

        // Clear any cookies that are linked to this request
        clearSessionCookies(req, res, requestUri)

        sendAuthorizeRedirect(req, res, redirect)
      }),
    )
  }

  /**
   * Provides a better UX when a request is denied by redirecting to the
   * client with the error details. This will also log any error that caused
   * the access to be denied (such as system errors).
   */
  function accessDeniedToRedirectCatcher(
    req: TReq,
    res: TRes,
    err: unknown,
  ): AuthorizationResultRedirect {
    if (err instanceof AccessDeniedError && err.parameters.redirect_uri) {
      const { cause } = err
      if (cause) onError?.(req, res, cause, 'Access denied')

      return {
        issuer: server.issuer,
        parameters: err.parameters,
        redirect: err.toJSON(),
      }
    }

    throw err
  }
}

function throwInvalidRequest(err: unknown): never {
  throw new InvalidRequestError(
    extractZodErrorMessage(err) ?? 'Input validation error',
    err,
  )
}

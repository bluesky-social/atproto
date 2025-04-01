import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  oauthAuthorizationRequestQuerySchema,
  oauthClientCredentialsSchema,
} from '@atproto/oauth-types'
import { AUTHENTICATION_LEEWAY } from '../../constants.js'
import { AccessDeniedError } from '../../errors/access-denied-error.js'
import { InvalidRequestError } from '../../errors/invalid-request-error.js'
import { LoginRequiredError } from '../../errors/login-required-error.js'
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
import { clearSessionCookies, hasEphemeralCookie } from '../api-router.js'
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

      const result = await server.authorize(
        clientCredentials,
        authorizationRequest,
        deviceInfo.deviceId,
        deviceInfo.deviceMetadata,
      )

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

      const { requestUri } = this

      // @TODO move this into server method and re-use in authorize() from api-router
      const { deviceId, deviceMetadata } = await server.deviceManager.load(
        req,
        res,
        true,
      )

      const { id, parameters, clientId } = await server.requestManager.get(
        requestUri,
        deviceId,
      )

      try {
        const client = await server.clientManager.getClient(clientId)

        const deviceAccount = await server.accountManager.getDeviceAccount(
          deviceId,
          sub,
          requestUri,
        )

        if (!hasEphemeralCookie(req, deviceAccount, requestUri)) {
          throw new LoginRequiredError(parameters, 'Invalid session cookie')
        }

        // @NOTE We add some leeway here because the `loginRequired` that was
        // returned to the client might be a bit outdated.
        if (server.checkLoginRequired(deviceAccount, AUTHENTICATION_LEEWAY)) {
          // @TODO: This should be caught and handled by the authorization server
          // instead of being sent to the client.
          throw new LoginRequiredError(
            parameters,
            'Account authentication required.',
          )
        }

        const { account, authorizedClients } = deviceAccount

        const code = await server.requestManager.setAuthorized(
          requestUri,
          client,
          account,
          deviceId,
          deviceMetadata,
        )

        const clientData = authorizedClients.get(clientId)
        if (server.checkConsentRequired(parameters, clientData)) {
          const scopes = new Set(clientData?.authorizedScopes)

          // Add the newly accepted scopes to the authorized scopes
          for (const s of parameters.scope?.split(' ') ?? []) scopes.add(s)

          await server.accountManager.setAuthorizedClient(account, client, {
            ...clientData,
            authorizedScopes: [...scopes],
          })
        }

        const { issuer } = server
        return { issuer, parameters, redirect: { code } }
      } catch (err) {
        try {
          await server.requestManager.delete(requestUri)
        } catch (err) {
          onError?.(req, res, err, 'Failed to delete request')
        }

        // Wrap into an AccessDeniedError to allow redirecting the user
        throw AccessDeniedError.from(parameters, err)
      } finally {
        await server.accountManager.removeRequestAccounts(id)
      }
    }),
  )

  router.use(
    buildRedirectMiddleware('/reject', async function (req, res) {
      const deviceInfo = await server.deviceManager.load(req, res, true)

      const { deviceId } = deviceInfo
      const { requestUri } = this

      const { id, parameters } = await server.requestManager.get(
        requestUri,
        deviceId,
      )

      try {
        try {
          await server.requestManager.delete(requestUri)
        } catch (err) {
          onError?.(req, res, err, 'Failed to delete request')
        }

        return {
          issuer: server.issuer,
          parameters: parameters,
          redirect: {
            error: 'access_denied',
            error_description: 'Access denied',
          },
        }
      } catch (err) {
        throw AccessDeniedError.from(parameters, err)
      } finally {
        await server.accountManager.removeRequestAccounts(id)
      }
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
          if (typeof err === 'string') {
            return next(err)
          }

          // If we have the "redirect_uri" parameter, we can redirect the user
          // to the client with an error.
          if (err instanceof AccessDeniedError && err.parameters.redirect_uri) {
            // Prefer logging the cause
            onError?.(req, res, err.cause ?? err, 'Authorization failed')

            return sendAuthorizeRedirect(req, res, {
              issuer: server.issuer,
              parameters: err.parameters,
              redirect: err.toJSON(),
            })
          }

          onError?.(
            req,
            res,
            err,
            `Failed to handle navigation request to "${req.url}"`,
          )

          if (res.headersSent) {
            return next(err)
          }

          // Display the error to the user
          sendErrorPage(req, res, err)
        } catch (err) {
          next(err)
        }
      }
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

        try {
          const csrfToken = this.url.searchParams.get('csrf_token')
          validateCsrfToken(req, csrfToken, requestUri)

          const context = subCtx(this, { requestUri })

          const redirect = await buildRedirect.call(context, req, res)

          clearSessionCookies(req, res, requestUri)

          sendAuthorizeRedirect(req, res, redirect)
        } catch (err) {
          clearSessionCookies(req, res, requestUri)

          throw err
        }
      }),
    )
  }
}

function throwInvalidRequest(err: unknown): never {
  throw new InvalidRequestError(
    extractZodErrorMessage(err) ?? 'Input validation error',
    err,
  )
}

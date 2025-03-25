import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { z } from 'zod'
import { ApiEndpoints } from '@atproto/oauth-provider-api'
import {
  oauthAuthorizationRequestQuerySchema,
  oauthClientCredentialsSchema,
} from '@atproto/oauth-types'
import {
  handleSchema,
  resetPasswordConfirmDataSchema,
  resetPasswordRequestDataSchema,
} from '../account/account-store.js'
import { signInDataSchema } from '../account/sign-in-data.js'
import { signUpInputSchema } from '../account/sign-up-input.js'
import { DeviceInfo } from '../device/device-manager.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import {
  Handler,
  Middleware,
  NextFunction,
  Router,
  RouterCtx,
  SubCtx,
  asHandler,
  clearCsrfCookie,
  extractLocales,
  jsonHandler,
  navigationHandler,
  parseHttpRequest,
  setupCsrfToken,
  subCtx,
  validateCsrfToken,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferer,
} from '../lib/http/index.js'
import { RouteCtx, createRoute } from '../lib/http/route.js'
import { extractZodErrorMessage } from '../lib/util/zod-error.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { Awaitable } from '../oauth-store.js'
import { RequestUri, requestUriSchema } from '../request/request-uri.js'
import { RouterOptions } from '../router/router-options.js'
import { assetsMiddleware } from './assets-middleware.js'
import { AuthorizationResultAuthorize } from './build-authorize-data.js'
import { buildErrorPayload, buildErrorStatus } from './build-error-payload.js'
import { sendAuthorizePageFactory } from './send-authorize-page.js'
import {
  AuthorizationResultRedirect,
  sendAuthorizeRedirect,
} from './send-authorize-redirect.js'
import { sendErrorPageFactory } from './send-error-page.js'

export function buildAuthorizationPageRouter<
  TReq extends IncomingMessage = IncomingMessage,
  TRes extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  options?: RouterOptions<TReq, TRes>,
): Handler<void, TReq, TRes> {
  const onError = options?.onError
  const csrfCookie = (requestUri: RequestUri) => `csrf-${requestUri}`
  const sendAuthorizePage = sendAuthorizePageFactory(server.customization)
  const sendErrorPage = sendErrorPageFactory(server.customization)

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin
  const router = new Router<void, TReq, TRes>(issuerUrl)

  router.use(assetsMiddleware)

  router.get(
    '/oauth/authorize',
    authorizeNavigationHandler(
      withDeviceInfo(async function (req, res) {
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

        const result:
          | AuthorizationResultRedirect
          | AuthorizationResultAuthorize = await server
          .authorize(
            clientCredentials,
            authorizationRequest,
            this.deviceId,
            this.deviceMetadata,
          )
          .catch((err) => accessDeniedToRedirectCatcher(req, res, err))

        if ('redirect' in result) {
          return sendAuthorizeRedirect(res, result)
        } else {
          setupCsrfToken(res, csrfCookie(result.authorize.uri))
          return sendAuthorizePage(res, result, {
            preferredLocales: extractLocales(req),
          })
        }
      }),
    ),
  )

  router.use(
    apiMiddleware(
      '/verify-handle-availability',
      z.object({ handle: handleSchema }).strict(),
      async function () {
        await server.accountManager.verifyHandleAvailability(this.input.handle)
        return { available: true }
      },
    ),
  )

  router.use(
    apiMiddleware(
      '/sign-up',
      signUpInputSchema,
      withDeviceInfo(async function () {
        // De-structuring the result to avoid leaking un-needed information
        const { account } = await server.signUp(
          this.input,
          this.deviceId,
          this.deviceMetadata,
          this.requestUri,
        )
        return { account }
      }),
    ),
  )

  router.use(
    apiMiddleware(
      '/sign-in',
      signInDataSchema,
      withDeviceInfo(async function () {
        // De-structuring the result to avoid leaking un-needed information
        const { account, consentRequired } = await server.signIn(
          this.input,
          this.deviceId,
          this.deviceMetadata,
          this.requestUri,
        )
        return { account, consentRequired }
      }),
    ),
  )

  router.use(
    apiMiddleware(
      '/reset-password-request',
      resetPasswordRequestDataSchema,
      async function () {
        await server.accountManager.resetPasswordRequest(this.input)
        return { success: true }
      },
    ),
  )

  router.use(
    apiMiddleware(
      '/reset-password-confirm',
      resetPasswordConfirmDataSchema,
      async function () {
        await server.accountManager.resetPasswordConfirm(this.input)
        return { success: true }
      },
    ),
  )

  router.use(
    authorizationRedirectHandler(
      '/accept',
      withDeviceInfo(async function (req, res) {
        const sub = this.url.searchParams.get('account_sub')
        if (!sub) throw new InvalidRequestError('Account sub not provided')

        return server
          .acceptRequest(
            this.requestUri,
            this.deviceId,
            this.deviceMetadata,
            sub,
          )
          .catch((err) => accessDeniedToRedirectCatcher(req, res, err))
      }),
    ),
  )

  router.use(
    authorizationRedirectHandler(
      '/reject',
      withDeviceInfo(async function (req, res) {
        return server
          .rejectRequest(this.requestUri, this.deviceId, this.deviceMetadata)
          .catch((err) => accessDeniedToRedirectCatcher(req, res, err))
      }),
    ),
  )

  return router.buildHandler()

  type ApiContext<T extends RouterCtx, S extends z.ZodTypeAny> = SubCtx<
    T,
    {
      input: z.infer<S>
      requestUri?: RequestUri
    }
  >

  // The main purpose of this function is to ensure that the endpoint
  // implementation matches its type definition.
  function apiMiddleware<
    T extends RouterCtx,
    E extends keyof ApiEndpoints & `/${string}`,
    S extends z.ZodType<ApiEndpoints[E]['input']>,
  >(
    endpoint: E,
    inputSchema: S,
    buildOutput: (
      this: ApiContext<RouteCtx<T>, S>,
      req: TReq,
      res: TRes,
    ) => Awaitable<ApiEndpoints[E]['output']>,
  ): Middleware<T, TReq, TRes> {
    return createRoute(
      'POST',
      `/oauth/authorize${endpoint}`,
      apiHandler(inputSchema, buildOutput),
    )
  }

  function apiHandler<T extends RouterCtx, S extends z.ZodTypeAny>(
    inputSchema: S,
    buildJson: (this: ApiContext<T, S>, req: TReq, res: TRes) => unknown,
  ): Middleware<T, TReq, TRes> {
    return jsonHandler<T, TReq, TRes>(async function (req, res) {
      try {
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')

        validateFetchMode(req, ['same-origin'])
        validateFetchSite(req, ['same-origin'])
        validateOrigin(req, issuerOrigin)
        const referer = validateReferer(req, { origin: issuerOrigin })

        const requestUri =
          // Allows to determine if we are in an authorization context
          referer.pathname === '/oauth/authorize'
            ? await requestUriSchema.parseAsync(
                referer.searchParams.get('request_uri'),
              )
            : undefined

        if (requestUri) {
          validateCsrfToken(
            req,
            req.headers['x-csrf-token'],
            csrfCookie(requestUri),
          )
        } else if (referer.pathname === '/account') {
          // @TODO change ^ to match actual account creation page
          validateCsrfToken(req, req.headers['x-csrf-token'])
        } else {
          throw createHttpError(400, `Invalid referer ${referer}`)
        }

        const inputRaw = await parseHttpRequest(req, ['json'])
        const input = await inputSchema.parseAsync(inputRaw, { path: ['body'] })

        const context: ApiContext<T, S> = Object.create(this, {
          input: { value: input, enumerable: true },
          requestUri: { value: requestUri, enumerable: true },
        })
        const payload = await buildJson.call(context, req, res)
        return { payload, status: 200 }
      } catch (err) {
        onError?.(req, res, err, 'Failed to handle API request')

        // @TODO: Rework the API error responses (relying on codes)
        const payload = buildErrorPayload(err)
        const status = buildErrorStatus(err)

        return { payload, status }
      }
    })
  }

  function authorizeNavigationHandler<T extends RouterCtx>(
    middleware: Middleware<T, TReq, TRes>,
  ): Handler<T, TReq, TRes> {
    const handler = navigationHandler(issuerOrigin, middleware)
    return asHandler(function (this: T, req: TReq, res: TRes, next) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      handler.call(this, req, res, (err) => {
        if (!err || typeof err === 'string') {
          // A middleware wrapped with navigationHandler should always end the
          // request, either by calling "next" with an error or by sending a
          // response.
          return next(new Error('Navigation handler should end the request'))
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

        sendErrorPage(res, err, {
          preferredLocales: extractLocales(req),
        }).catch(next)
      })
    })
  }

  function withDeviceInfo<T extends RouterCtx, Ret = unknown>(
    handler: (
      this: SubCtx<T, DeviceInfo>,
      req: TReq,
      res: TRes,
      next?: NextFunction,
    ) => Awaitable<Ret>,
  ) {
    return async function (
      this: T,
      req: TReq,
      res: TRes,
      next?: NextFunction,
    ): Promise<Ret> {
      const deviceInfo = await server.deviceManager.load(req, res)

      const context: SubCtx<
        T,
        {
          deviceId: DeviceInfo['deviceId']
          deviceMetadata: DeviceInfo['deviceMetadata']
        }
      > = Object.create(this, {
        deviceId: { value: deviceInfo.deviceId, enumerable: true },
        deviceMetadata: { value: deviceInfo.deviceMetadata, enumerable: true },
      })

      return handler.call(context, req, res, next)
    }
  }

  type RedirectContext<T extends RouterCtx> = SubCtx<
    RouteCtx<T>,
    { requestUri: RequestUri }
  >

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
  function authorizationRedirectHandler<T extends RouterCtx>(
    endpoint: '/accept' | '/reject',
    handler: (
      this: RedirectContext<T>,
      req: TReq,
      res: TRes,
    ) => Awaitable<AuthorizationResultRedirect>,
  ): Middleware<T, TReq, TRes> {
    return createRoute(
      'GET',
      `/oauth/authorize${endpoint}`,
      authorizeNavigationHandler(async function (req, res) {
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
        const csrfCookieName = csrfCookie(requestUri)

        validateCsrfToken(req, csrfToken, csrfCookieName)

        const context = subCtx(this, 'requestUri', requestUri)

        const redirect = await handler.call(context, req, res)

        // Next line will "clear" the CSRF token cookie, preventing replay of
        // this request (navigating "back" will result in an error).
        clearCsrfCookie(res)

        await sendAuthorizeRedirect(res, redirect)
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

import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import {
  oauthAuthorizationRequestQuerySchema,
  oauthClientCredentialsSchema,
} from '@atproto/oauth-types'
import {
  DeviceId,
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
  RequestMetadata,
  Router,
  RouterCtx,
  SubCtx,
  extractLocales,
  jsonHandler,
  navigationHandler,
  parseHttpRequest,
  setupCsrfToken,
  validateCsrfToken,
  validateFetchMode,
  validateFetchSite,
  validateReferer,
  validateSameOrigin,
} from '../lib/http/index.js'
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
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  options?: RouterOptions<Req, Res>,
): Router<void, Req, Res> {
  const onError = options?.onError
  const csrfCookie = (requestUri: RequestUri) => `csrf-${requestUri}`
  const sendAuthorizePage = sendAuthorizePageFactory(server.customization)
  const sendErrorPage = sendErrorPageFactory(server.customization)

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin
  const router = new Router<void, Req, Res>(issuerUrl)

  router.use(assetsMiddleware)

  router.get(
    '/oauth/authorize',
    authorizeNavigationHandler(
      withDeviceInfo(async function (req, res) {
        validateFetchSite(req, res, ['cross-site', 'none'])

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
          await setupCsrfToken(req, res, csrfCookie(result.authorize.uri))
          return sendAuthorizePage(res, result, {
            preferredLocales: extractLocales(req),
          })
        }
      }),
    ),
  )

  router.post(
    '/oauth/authorize/verify-handle-availability',
    apiHandler(z.object({ handle: handleSchema }).strict(), async function () {
      await server.accountManager.verifyHandleAvailability(this.input.handle)
      return { available: true }
    }),
  )

  router.post(
    '/oauth/authorize/sign-up',
    apiHandler(
      signUpInputSchema,
      withDeviceInfo(async function () {
        return server.signUp(
          this.requestUri,
          this.deviceId,
          this.deviceMetadata,
          this.input,
        )
      }),
    ),
  )

  router.post(
    '/oauth/authorize/sign-in',
    apiHandler(
      signInDataSchema,
      withDeviceInfo(async function () {
        return server.signIn(
          this.requestUri,
          this.deviceId,
          this.deviceMetadata,
          this.input,
        )
      }),
    ),
  )

  router.post(
    '/oauth/authorize/reset-password-request',
    apiHandler(resetPasswordRequestDataSchema, async function () {
      await server.accountManager.resetPasswordRequest(this.input)
      return { success: true }
    }),
  )

  router.post(
    '/oauth/authorize/reset-password-confirm',
    apiHandler(resetPasswordConfirmDataSchema, async function () {
      await server.accountManager.resetPasswordConfirm(this.input)
      return { success: true }
    }),
  )

  router.get(
    '/oauth/authorize/accept',
    authorizeRedirectHandler(
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

  router.get(
    '/oauth/authorize/reject',
    authorizeRedirectHandler(
      withDeviceInfo(async function (req, res) {
        return server
          .rejectRequest(this.requestUri, this.deviceId)
          .catch((err) => accessDeniedToRedirectCatcher(req, res, err))
      }),
    ),
  )

  return router

  function apiHandler<
    T extends RouterCtx,
    S extends z.ZodTypeAny,
    TReq extends Req = Req,
    TRes extends Res = Res,
  >(
    inputSchema: S,
    buildJson: (
      this: SubCtx<T, { requestUri: RequestUri; input: z.infer<S> }>,
      req: TReq,
      res: TRes,
    ) => unknown,
    status?: number,
  ): Handler<T, TReq, TRes> {
    return jsonHandler<T, TReq, TRes>(async function (req, res) {
      try {
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')

        validateFetchMode(req, res, ['same-origin'])
        validateFetchSite(req, res, ['same-origin'])
        validateSameOrigin(req, res, issuerOrigin)
        const referer = validateReferer(req, res, {
          origin: issuerOrigin,
          pathname: '/oauth/authorize',
        })

        const requestUri = await requestUriSchema.parseAsync(
          referer.searchParams.get('request_uri'),
          { path: ['query', 'request_uri'] },
        )

        validateCsrfToken(
          req,
          res,
          req.headers['x-csrf-token'],
          csrfCookie(requestUri),
        )

        const inputRaw = await parseHttpRequest(req, ['json'])
        const input = await inputSchema.parseAsync(inputRaw, { path: ['body'] })

        const context: SubCtx<
          T,
          { requestUri: RequestUri; input: z.infer<S> }
        > = Object.create(this, {
          input: { value: input },
          requestUri: { value: requestUri },
        })
        const payload = await buildJson.call(context, req, res)
        return { payload, status }
      } catch (err) {
        onError?.(req, res, err, 'Failed to handle API request')

        // @TODO: Rework the API error responses (relying on codes)
        const payload = buildErrorPayload(err)
        const status = buildErrorStatus(err)

        return { payload, status }
      }
    })
  }

  function authorizeNavigationHandler<
    T extends RouterCtx,
    TReq extends Req = Req,
    TRes extends Res = Res,
  >(handler: Handler<T, TReq, TRes>): Handler<T, TReq, TRes> {
    const innerHandler = navigationHandler(issuerOrigin, handler)
    return function (req, res, next) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      innerHandler.call(this, req, res, (err) => {
        // Wrap the 'next' function with one that will send an error

        onError?.(
          req,
          res,
          err,
          `Failed to handle navigation request to "${req.url}"`,
        )

        if (res.headersSent) return res.destroy()

        sendErrorPage(res, err, {
          preferredLocales: extractLocales(req),
        }).catch((err) => {
          if (next) return next(err)
          else res.writeHead(500).end('Internal Server Error')
        })
      })
    }
  }

  function withDeviceInfo<
    T extends RouterCtx,
    Req extends IncomingMessage = IncomingMessage,
    Res extends ServerResponse = ServerResponse,
    Ret = unknown,
  >(
    handler: (
      this: SubCtx<T, DeviceInfo>,
      req: Req,
      res: Res,
    ) => Awaitable<Ret>,
  ) {
    return async function (this: T, req: Req, res: Res): Promise<Ret> {
      const deviceInfo = await server.deviceManager.load(req, res)

      const context: SubCtx<
        T,
        {
          deviceId: DeviceId
          deviceMetadata: RequestMetadata
        }
      > = Object.create(this, {
        deviceId: { value: deviceInfo.deviceId },
        deviceMetadata: { value: deviceInfo.deviceMetadata },
      })

      return handler.call(context, req, res)
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
  function authorizeRedirectHandler<
    T extends RouterCtx,
    TReq extends Req = Req,
    TRes extends Res = Res,
  >(
    handler: (
      this: SubCtx<T, { requestUri: RequestUri }>,
      req: TReq,
      res: TRes,
    ) => Awaitable<AuthorizationResultRedirect>,
  ): Handler<T, TReq, TRes> {
    return authorizeNavigationHandler(async function (req, res) {
      validateFetchSite(req, res, ['same-origin'])

      const referer = validateReferer(req, res, {
        origin: issuerOrigin,
        pathname: '/oauth/authorize',
      })

      const requestUri = await requestUriSchema.parseAsync(
        referer.searchParams.get('request_uri'),
      )

      const csrfToken = this.url.searchParams.get('csrf_token')
      const csrfCookieName = csrfCookie(requestUri)

      // Next line will "clear" the CSRF token cookie, preventing replay of
      // this request (navigating "back" will result in an error).
      validateCsrfToken(req, res, csrfToken, csrfCookieName, true)

      const context: SubCtx<T, { requestUri: RequestUri }> = Object.create(
        this,
        {
          requestUri: { value: requestUri },
        },
      )

      const redirect = await handler.call(context, req, res)
      return sendAuthorizeRedirect(res, redirect)
    })
  }

  /**
   * Provides a better UX when a request is denied by redirecting to the
   * client with the error details. This will also log any error that caused
   * the access to be denied (such as system errors).
   */
  function accessDeniedToRedirectCatcher(
    req: Req,
    res: Res,
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

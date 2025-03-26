import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { z } from 'zod'
import { API_ENDPOINT_PREFIX, ApiEndpoints } from '@atproto/oauth-provider-api'
import {
  handleSchema,
  resetPasswordConfirmDataSchema,
  resetPasswordRequestDataSchema,
} from '../account/account-store.js'
import { signInDataSchema } from '../account/sign-in-data.js'
import { signUpInputSchema } from '../account/sign-up-input.js'
import { deviceIdSchema } from '../device/device-id.js'
import { DeviceInfo } from '../device/device-manager.js'
import { buildErrorPayload, buildErrorStatus } from '../errors/error-parser.js'
import {
  Middleware,
  NextFunction,
  Router,
  RouterCtx,
  SubCtx,
  jsonHandler,
  parseHttpRequest,
  subCtx,
  validateCsrfToken,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferer,
} from '../lib/http/index.js'
import { RouteCtx, createRoute } from '../lib/http/route.js'
import { Awaitable } from '../lib/util/type.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { RequestUri, requestUriSchema } from '../request/request-uri.js'
import { authorizePageCsrfCookie } from './authorize-page/send-authorize-page.js'
import { RouterOptions } from './router-options.js'

export function apiRouter<
  TReq extends IncomingMessage = IncomingMessage,
  TRes extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  options?: RouterOptions<TReq, TRes>,
): Router<void, TReq, TRes> {
  const onError = options?.onError

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin
  const router = new Router<void, TReq, TRes>(issuerUrl)

  router.use(
    apiRoute(
      'POST',
      '/verify-handle-availability',
      z.object({ handle: handleSchema }).strict(),
      async function () {
        await server.accountManager.verifyHandleAvailability(this.input.handle)
        return { available: true }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
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
    apiRoute(
      'POST',
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
    apiRoute(
      'POST',
      '/reset-password-request',
      resetPasswordRequestDataSchema,
      async function () {
        await server.accountManager.resetPasswordRequest(this.input)
        return { success: true }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
      '/reset-password-confirm',
      resetPasswordConfirmDataSchema,
      async function () {
        await server.accountManager.resetPasswordConfirm(this.input)
        return { success: true }
      },
    ),
  )

  router.use(
    apiRoute('GET', '/accounts', undefined, async function () {
      // @TODO
      return { accounts: [] }
    }),
  )

  router.use(
    apiRoute(
      'GET',
      '/oauth-sessions',
      z.object({ account: z.string() }).strict(),
      async function () {
        // @TODO
        return { sessions: [] }
      },
    ),
  )

  router.use(
    apiRoute(
      'GET',
      '/account-sessions',
      z.object({ account: z.string() }).strict(),
      async function () {
        // @TODO
        return { sessions: [] }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
      '/revoke-account-session',
      z.object({ account: z.string(), deviceId: deviceIdSchema }).strict(),
      async function () {
        // @TODO
        return { success: true }
      },
    ),
  )

  return router

  type ApiContext<T extends RouterCtx, I> = SubCtx<
    T,
    {
      requestUri?: RequestUri
      input: I
    }
  >

  type InferInput<S extends void | z.ZodTypeAny> = S extends z.ZodTypeAny
    ? z.infer<S>
    : void

  // The main purpose of this function is to ensure that the endpoint
  // implementation matches its type definition.
  function apiRoute<
    T extends RouterCtx,
    E extends keyof ApiEndpoints & `/${string}`,
    S extends ApiEndpoints[E] extends { method: 'POST' }
      ? z.ZodType<ApiEndpoints[E]['input']>
      : ApiEndpoints[E] extends { method: 'GET'; params: unknown }
        ? z.ZodType<ApiEndpoints[E]['params']>
        : void,
  >(
    method: ApiEndpoints[E]['method'],
    endpoint: E,
    schema: S,
    buildJson: (
      this: ApiContext<RouteCtx<T>, InferInput<S>>,
      req: TReq,
      res: TRes,
    ) => Awaitable<ApiEndpoints[E]['output']>,
  ): Middleware<T, TReq, TRes> {
    return createRoute(
      method,
      `${API_ENDPOINT_PREFIX}${endpoint}`,
      apiMiddleware(method, schema, buildJson),
    )
  }

  function apiMiddleware<T extends RouterCtx, S extends void | z.ZodTypeAny>(
    method: 'GET' | 'POST',
    schema: S,
    buildJson: (
      this: ApiContext<T, InferInput<S>>,
      req: TReq,
      res: TRes,
    ) => unknown,
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
            authorizePageCsrfCookie(requestUri),
          )
        } else if (referer.pathname === '/account') {
          // @TODO change ^ to match actual account creation page
          validateCsrfToken(req, req.headers['x-csrf-token'])
        } else {
          throw createHttpError(400, `Invalid referer ${referer}`)
        }

        const inputRaw =
          method === 'POST'
            ? await parseHttpRequest(req, ['json'])
            : method === 'GET'
              ? Object.fromEntries(this.url.searchParams)
              : undefined

        const input: InferInput<S> = await schema?.parseAsync(inputRaw, {
          path: ['body'],
        })

        const context = subCtx(this, { input, requestUri })
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

  function withDeviceInfo<T extends RouterCtx, Ret = unknown>(
    fn: (
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
      const context = subCtx(this, deviceInfo)
      return fn.call(context, req, res, next)
    }
  }
}

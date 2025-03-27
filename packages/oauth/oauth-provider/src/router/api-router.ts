import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { z } from 'zod'
import {
  ACCOUNTS_PAGE_URL,
  API_ENDPOINT_PREFIX,
  ApiEndpoints,
} from '@atproto/oauth-provider-api'
import {
  handleSchema,
  resetPasswordConfirmDataSchema,
  resetPasswordRequestDataSchema,
} from '../account/account-store.js'
import { signInDataSchema } from '../account/sign-in-data.js'
import { signUpInputSchema } from '../account/sign-up-input.js'
import { deviceIdSchema } from '../device/device-id.js'
import { buildErrorPayload, buildErrorStatus } from '../errors/error-parser.js'
import {
  Middleware,
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
import type { Awaitable } from '../lib/util/type.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { RequestUri, requestUriSchema } from '../request/request-uri.js'
import { authorizePageCsrfCookie } from './authorize-page/send-authorize-page.js'
import type { RouterOptions } from './router-options.js'

const verifyHandleSchema = z.object({ handle: handleSchema }).strict()

export function apiRouter<
  T extends object | void = void,
  TReq extends IncomingMessage = IncomingMessage,
  TRes extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  options: RouterOptions<TReq, TRes>,
): Router<T, TReq, TRes> {
  const { onError } = options

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin
  const router = new Router<T, TReq, TRes>(issuerUrl)

  router.use(
    apiRoute(
      'POST',
      '/verify-handle-availability',
      verifyHandleSchema,
      async function () {
        await server.accountManager.verifyHandleAvailability(this.input.handle)
        return { available: true }
      },
    ),
  )

  router.use(
    apiRoute('POST', '/sign-up', signUpInputSchema, async function (req, res) {
      const deviceInfo = await server.deviceManager.load(req, res)

      // De-structuring the result to avoid leaking un-needed information
      const { account } = await server.signUp(
        deviceInfo.deviceId,
        deviceInfo.deviceMetadata,
        this.input,
        this.requestUri,
      )

      return { account }
    }),
  )

  router.use(
    apiRoute('POST', '/sign-in', signInDataSchema, async function (req, res) {
      const deviceInfo = await server.deviceManager.load(req, res)

      // De-structuring the result to avoid leaking un-needed information
      const { account, consentRequired } = await server.signIn(
        deviceInfo.deviceId,
        deviceInfo.deviceMetadata,
        this.input,
        this.requestUri,
      )

      return { account, consentRequired }
    }),
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
    apiRoute('GET', '/accounts', undefined, async function (req, res) {
      const deviceInfo = await server.deviceManager.load(req, res)

      const deviceAccounts = await server.accountManager.list(
        deviceInfo.deviceId,
      )

      return {
        accounts: deviceAccounts.map(({ account }) => account),
      }
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
        await server.accountManager.removeDeviceAccount(
          this.input.deviceId,
          this.input.account,
        )

        return { success: true }
      },
    ),
  )

  return router

  type ApiContext<T extends RouterCtx, I = void> = SubCtx<
    T,
    {
      /**
       * The parsed input data (json payload if "POST", query params if "GET").
       */
      input: I

      /**
       * When defined, the request originated from the authorize page.
       */
      requestUri?: RequestUri
    }
  >

  type InferValidation<S extends void | z.ZodTypeAny> = S extends z.ZodTypeAny
    ? z.infer<S>
    : void

  /**
   * The main purpose of this function is to ensure that the endpoint
   * implementation matches its type definition from {@link ApiEndpoints}.
   * @private
   */
  function apiRoute<
    C extends RouterCtx<T>,
    M extends 'GET' | 'POST',
    E extends `/${string}` &
      // Extract all the endpoint path that match the method (allows for
      // auto-complete & better error reporting)
      {
        [E in keyof ApiEndpoints]: ApiEndpoints[E] extends { method: M }
          ? E
          : never
      }[keyof ApiEndpoints],
    S extends // A schema that validates the POST input or GET params
      ApiEndpoints[E] extends { method: 'POST'; input: infer I }
        ? z.ZodType<I>
        : ApiEndpoints[E] extends { method: 'GET'; params: infer P }
          ? z.ZodType<P>
          : void,
  >(
    method: M,
    endpoint: E,
    schema: S,
    buildJson: (
      this: ApiContext<RouteCtx<C>, InferValidation<S>>,
      req: TReq,
      res: TRes,
    ) => Awaitable<ApiEndpoints[E]['output']>,
  ): Middleware<C, TReq, TRes> {
    return createRoute(
      method,
      `${API_ENDPOINT_PREFIX}${endpoint}`,
      apiMiddleware(method, schema, buildJson),
    )
  }

  function apiMiddleware<C extends RouterCtx, S extends void | z.ZodTypeAny>(
    method: 'GET' | 'POST',
    schema: S,
    buildJson: (
      this: ApiContext<C, InferValidation<S>>,
      req: TReq,
      res: TRes,
    ) => unknown,
  ): Middleware<C, TReq, TRes> {
    const parseInput: (this: C, req: TReq) => Promise<InferValidation<S>> =
      schema == null // No schema means endpoint doesn't accept any input
        ? async function (req) {
            req.resume() // Flush body
            return undefined
          }
        : method === 'POST'
          ? async function (req) {
              const body = await parseHttpRequest(req, ['json'])
              return schema.parseAsync(body, { path: ['body'] })
            }
          : async function (req) {
              req.resume() // Flush body
              const query = Object.fromEntries(this.url.searchParams)
              return schema.parseAsync(query, { path: ['query'] })
            }

    return jsonHandler<C, TReq, TRes>(async function (req, res) {
      try {
        // Prevent caching of API routes
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')

        // Prevent CORS requests
        validateFetchMode(req, ['same-origin'])
        validateFetchSite(req, ['same-origin'])
        validateOrigin(req, issuerOrigin)
        const referer = validateReferer(req, { origin: issuerOrigin })

        // Check if the request originated from the authorize page
        const requestUri =
          referer.pathname === '/oauth/authorize'
            ? await requestUriSchema.parseAsync(
                referer.searchParams.get('request_uri'),
              )
            : undefined

        // Validate CSRF token
        if (requestUri) {
          const cookieName = authorizePageCsrfCookie(requestUri)
          validateCsrfToken(req, req.headers['x-csrf-token'], cookieName)
        } else if (
          referer.pathname === ACCOUNTS_PAGE_URL ||
          referer.pathname.startsWith(`${ACCOUNTS_PAGE_URL}/`)
        ) {
          validateCsrfToken(req, req.headers['x-csrf-token'])
        } else {
          throw createHttpError(400, `Invalid referer ${referer}`)
        }

        // Parse and validate the input data
        const input = await parseInput.call(this, req)

        // Generate the API response
        const context = subCtx(this, { input, requestUri })
        const payload = await buildJson.call(context, req, res)

        return { payload, status: 200 }
      } catch (err) {
        onError?.(req, res, err, 'Failed to handle API request')

        // @TODO Rework the API error responses (relying on codes)
        const payload = buildErrorPayload(err)
        const status = buildErrorStatus(err)

        return { payload, status }
      }
    })
  }
}

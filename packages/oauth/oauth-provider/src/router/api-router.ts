import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { z } from 'zod'
import {
  ACCOUNTS_PAGE_URL,
  API_ENDPOINT_PREFIX,
  ActiveAccountSession,
  ActiveDeviceAccount,
  ActiveOAuthSession,
  ApiEndpoints,
  ISODateString,
} from '@atproto/oauth-provider-api'
import {
  OAuthAuthorizationRequestParameters,
  OAuthClientId,
  OAuthRedirectUri,
  OAuthResponseMode,
  oauthRedirectUriSchema,
  oauthResponseModeSchema,
} from '@atproto/oauth-types'
import {
  DeviceAccount,
  handleSchema,
  resetPasswordConfirmDataSchema,
  resetPasswordRequestDataSchema,
} from '../account/account-store.js'
import { signInDataSchema } from '../account/sign-in-data.js'
import { signUpInputSchema } from '../account/sign-up-input.js'
import { Client } from '../client/client.js'
import { DeviceId, deviceIdSchema } from '../device/device-id.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { buildErrorPayload, buildErrorStatus } from '../errors/error-parser.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { LoginRequiredError } from '../errors/login-required-error.js'
import {
  CookieSerializeOptions,
  Middleware,
  RequestMetadata,
  Router,
  RouterCtx,
  SubCtx,
  clearCookie,
  jsonHandler,
  parseHttpCookies,
  parseHttpRequest,
  setCookie,
  subCtx,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferer,
} from '../lib/http/index.js'
import { RouteCtx, createRoute } from '../lib/http/route.js'
import { asArray } from '../lib/util/cast.js'
import type { Awaitable } from '../lib/util/type.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { subSchema } from '../oidc/sub.js'
import { RequestInfo } from '../request/request-info.js'
import { RequestUri, requestUriSchema } from '../request/request-uri.js'
import { AuthorizationRedirectParameters } from '../result/authorization-redirect-parameters.js'
import {
  ERROR_REDIRECT_KEYS,
  OAuthRedirectOptions,
  OAuthRedirectQueryParameter,
  SUCCESS_REDIRECT_KEYS,
  buildRedirectEntries,
  buildRedirectUri,
} from './authorize-page/send-authorize-redirect.js'
import { validateCsrfToken } from './csrf.js'
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
      const deviceInfo = await server.deviceManager.load(req, res, true)

      const { account, ephemeralCookie } =
        await server.accountManager.createAccount(
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
          this.input,
          this.requestUri,
        )

      if (ephemeralCookie) {
        setEphemeralCookie(res, ephemeralCookie, this.requestUri)
      }

      return { account }
    }),
  )

  router.use(
    apiRoute('POST', '/sign-in', signInDataSchema, async function (req, res) {
      const deviceInfo = await server.deviceManager.load(req, res, true)

      const { account, ephemeralCookie } =
        await server.accountManager.authenticateAccount(
          deviceInfo.deviceId,
          deviceInfo.deviceMetadata,
          this.input,
          this.requestUri,
        )

      if (ephemeralCookie) {
        setEphemeralCookie(res, ephemeralCookie, this.requestUri)
      }

      if (this.requestUri) {
        // Check if a consent is required for the client, but only if this
        // call is made within the context of an oauth request.

        const { clientId, parameters } = await server.requestManager.get(
          this.requestUri,
          deviceInfo.deviceId,
        )

        const { authorizedClients } = await server.accountManager.getAccount(
          account.sub,
        )

        return {
          account,
          consentRequired: server.checkConsentRequired(
            parameters,
            authorizedClients.get(clientId),
          ),
        }
      }

      return { account }
    }),
  )

  router.use(
    apiRoute(
      'POST',
      '/sign-out',
      z.object({ sub: z.union([subSchema, z.array(subSchema)]) }).strict(),
      async function (req, res) {
        const { deviceId } = await server.deviceManager.load(req, res, true)

        const uniqueSubs = new Set(asArray(this.input.sub))

        for (const sub of uniqueSubs) {
          await server.accountManager.removeDeviceAccounts(deviceId, sub)
        }

        return { success: true as const }
      },
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
    apiRoute('GET', '/accounts', undefined, async function (req, res) {
      const { deviceId } = await server.deviceManager.load(req, res)

      const deviceAccounts = await server.accountManager.listDeviceAccounts(
        deviceId,
        this.requestUri,
        extractEphemeralCookies(req, this.requestUri),
      )

      return {
        results: deviceAccounts.map(
          (deviceAccount): ActiveDeviceAccount => ({
            account: deviceAccount.account,
            remembered: deviceAccount.data.remembered,
            loginRequired: server.checkLoginRequired(deviceAccount),
          }),
        ),
      }
    }),
  )

  router.use(
    apiRoute(
      'GET',
      '/oauth-sessions',
      z.object({ sub: subSchema }).strict(),
      async function (req, res) {
        const { deviceAccount } = await authenticate(
          req,
          res,
          this.input.sub,
          this.requestUri,
        )

        const tokenInfos = await server.tokenManager.listAccountTokens(
          deviceAccount.account.sub,
        )

        const uniqueClientIds = new Set(
          tokenInfos.map((tokenInfo) => tokenInfo.data.clientId),
        )

        const clients = new Map<OAuthClientId, Client>(
          (
            await Promise.all(
              Array.from(uniqueClientIds, async (clientId) =>
                server.clientManager.getClient(clientId).catch(() => null),
              ),
            )
          )
            .filter((client) => client != null)
            .map((client) => [client.id, client]),
        )

        return {
          // @TODO: We should ideally filter sessions that are expired (or even
          // expose the expiration date). This requires a change to the way
          // TokenInfo are stored (see TokenManager#isTokenExpired and
          // TokenManager#isTokenInactive).
          results: tokenInfos.map(({ id, data }): ActiveOAuthSession => {
            const client = clients.get(data.clientId)
            return {
              tokenId: id,

              createdAt: data.createdAt.toISOString() as ISODateString,
              updatedAt: data.updatedAt.toISOString() as ISODateString,

              clientId: data.clientId,
              clientMetadata: client?.metadata,

              scope: data.parameters.scope,
            }
          }),
        }
      },
    ),
  )

  router.use(
    apiRoute(
      'GET',
      '/account-sessions',
      z.object({ sub: subSchema }).strict(),
      async function (req, res) {
        const { deviceAccount } = await authenticate(
          req,
          res,
          this.input.sub,
          this.requestUri,
        )

        const deviceAccounts = await server.accountManager.listAccountDevices(
          deviceAccount.account.sub,
          this.requestUri,
          extractEphemeralCookies(req, this.requestUri),
        )

        return {
          results: deviceAccounts.map(
            ({ deviceId, deviceData, data }): ActiveAccountSession => ({
              deviceId,
              deviceMetadata: {
                ipAddress: deviceData.ipAddress,
                userAgent: deviceData.userAgent,
                lastSeenAt:
                  deviceData.lastSeenAt.toISOString() as ISODateString,
              },

              remembered: data.remembered,
            }),
          ),
        }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
      '/revoke-account-session',
      z.object({ sub: subSchema, deviceId: deviceIdSchema }).strict(),
      async function () {
        // @NOTE This route is not authenticated. If a user is able to steal
        // another user's session cookie, we allow them to revoke the device
        // session.

        await server.accountManager.removeDeviceAccounts(
          this.input.deviceId,
          this.input.sub,
        )

        return { success: true }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
      '/accept',
      z.object({ sub: subSchema }).strict(),
      async function (req, res) {
        const { requestUri } = this
        if (!requestUri) {
          throw new InvalidRequestError(
            'This endpoint can only be used in the context of an OAuth request',
          )
        }

        // Any AccessDeniedError caught in this block will result in a redirect
        // to the client's redirect_uri with an error.
        try {
          const { deviceId, deviceMetadata, deviceAccount, requestInfo } =
            await authenticate(req, res, this.input.sub, requestUri, true)

          const { clientId, parameters } = requestInfo
          // Any error thrown in this block will be transformed into an
          // AccessDeniedError in order to allow redirecting the user to the
          // client.
          try {
            const client = await server.clientManager.getClient(clientId)

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

            const url = buildRedirectUrl(server.issuer, parameters, { code })

            return { url }
          } catch (err) {
            try {
              await server.requestManager.delete(requestUri)
            } catch (err) {
              onError?.(req, res, err, 'Failed to delete request')
            }

            throw AccessDeniedError.from(parameters, err, 'server_error')
          }
        } catch (err) {
          if (err instanceof AccessDeniedError && err.parameters.redirect_uri) {
            // Prefer logging the cause
            onError?.(req, res, err.cause ?? err, 'Authorization failed')

            const url = buildRedirectUrl(
              server.issuer,
              err.parameters,
              err.toJSON(),
            )

            return { url }
          }

          throw err
        } finally {
          clearSessionCookies(req, res, requestUri)

          await server.accountManager
            .removeRequestAccounts(requestUri)
            .catch((err) => {
              onError?.(req, res, err, 'Failed to remove request accounts')
            })
        }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
      '/reject',
      z.object({}).strict(),
      async function (req, res) {
        const { requestUri } = this
        if (!requestUri) {
          throw new InvalidRequestError(
            'This endpoint can only be used in the context of an OAuth request',
          )
        }

        // Once this endpoint is called, the request will definitely be
        // rejected.
        try {
          // No need to authenticate the user here as they are not authorizing a
          // particular account (CSRF protection is enough).

          // @NOTE that the client could *technically* trigger this endpoint while
          // the user is on the authorize page by forging the request (because the
          // client knows the RequestURI from PAR and has all the info needed to
          // forge the request, including CSRF). This cannot be used as DoS attack
          // as the request ID is not guessable and would only result in a bad UX
          // for misbehaving clients, only for the users of those clients.

          const { deviceId } = await server.deviceManager.load(req, res, true)

          const { parameters } = await server.requestManager.get(
            requestUri,
            deviceId,
          )

          const url = buildRedirectUrl(server.issuer, parameters, {
            error: 'access_denied',
            error_description: 'The user rejected the request',
          })

          return { url }
        } catch (err) {
          if (err instanceof AccessDeniedError && err.parameters.redirect_uri) {
            // Prefer logging the cause
            onError?.(req, res, err.cause ?? err, 'Authorization failed')

            const url = buildRedirectUrl(
              server.issuer,
              err.parameters,
              err.toJSON(),
            )

            return { url }
          }

          throw err
        } finally {
          clearSessionCookies(req, res, requestUri)

          await server.accountManager
            .removeRequestAccounts(requestUri)
            .catch((err) => {
              onError?.(req, res, err, 'Failed to remove request accounts')
            })

          await server.requestManager.delete(requestUri).catch((err) => {
            onError?.(req, res, err, 'Failed to delete request')
          })
        }
      },
    ),
  )

  return router

  async function authenticate(
    req: TReq,
    res: TRes,
    sub: string,
    requestUri: RequestUri,
    rotateDeviceCookie?: boolean,
  ): Promise<{
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    deviceAccount: DeviceAccount
    requestInfo: RequestInfo
  }>
  async function authenticate(
    req: TReq,
    res: TRes,
    sub: string,
    requestUri: RequestUri | undefined,
    rotateDeviceCookie?: boolean,
  ): Promise<{
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    deviceAccount: DeviceAccount
    requestInfo?: RequestInfo
  }>
  async function authenticate(
    req: TReq,
    res: TRes,
    sub: string,
    requestUri: RequestUri | undefined,
    rotateDeviceCookie: boolean = false,
  ): Promise<{
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    deviceAccount: DeviceAccount
    requestInfo?: RequestInfo
  }> {
    const { deviceId, deviceMetadata } = await server.deviceManager.load(
      req,
      res,
      rotateDeviceCookie,
    )

    const requestInfo = requestUri
      ? await server.requestManager.get(requestUri, deviceId)
      : undefined

    const parameters = requestInfo?.parameters

    // Ensures the requested "sub" is linked to the device
    const deviceAccount = await server.accountManager
      .getDeviceAccount(deviceId, sub, requestUri)
      .catch((err) => {
        throw parameters //
          ? LoginRequiredError.from(parameters, err)
          : err
      })

    // If the session is temporary, check the cookie secret
    if (!hasEphemeralCookie(req, deviceAccount, requestUri)) {
      await server.accountManager.removeDeviceAccounts(deviceId, sub)
      const message = 'Invalid session cookie'
      throw parameters
        ? new LoginRequiredError(parameters, message)
        : new InvalidRequestError(message)
    }

    // The session exists but was created too long ago
    if (server.checkLoginRequired(deviceAccount)) {
      const message = 'Login required'
      throw parameters
        ? new LoginRequiredError(parameters, message)
        : new InvalidRequestError(message)
    }

    return { deviceId, deviceMetadata, deviceAccount, requestInfo }
  }

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
              // @NOTE This should not be necessary with GET requests
              req.resume().once('error', (_err) => {
                // Ignore errors when flushing the request body
                // (e.g. client closed connection)
              })

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
          validateCsrfToken(req, req.headers['x-csrf-token'], requestUri)
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

const EPHEMERAL_COOKIE_OPTIONS: Readonly<CookieSerializeOptions> =
  Object.freeze({
    expires: undefined, // session
    sameSite: 'strict',
    secure: true,
    httpOnly: true,
  })

function ephemeralCookieValue(requestUri?: RequestUri) {
  return requestUri ? `sec-${requestUri}` : 'sec-no-request'
}

/**
 * When session are created without "remember me", a session cookie is created
 * and stored in the account store & sent to the client. This cookie is used to
 * ensure that the authentication can no-longer be used once the device ends the
 * "session" (typically is closed), or once the session is accepted/rejected
 * (see {@link clearSessionCookies}). A safer alternative would be to store that
 * value in the browser's JS. This solution was not adopted for practical
 * reasons (avoid having to distinguish between remembered/non-remembered in the
 * front-end).
 */
function setEphemeralCookie(
  res: ServerResponse,
  ephemeralCookie: string,
  requestUri: RequestUri | undefined,
) {
  const cookieValue = ephemeralCookieValue(requestUri)
  setCookie(res, ephemeralCookie, cookieValue, EPHEMERAL_COOKIE_OPTIONS)
}

export function hasEphemeralCookie(
  req: IncomingMessage,
  deviceAccount: DeviceAccount,
  requestUri: RequestUri | undefined,
) {
  const { ephemeralCookie } = deviceAccount.data
  if (!ephemeralCookie) return true
  const cookies = parseHttpCookies(req)
  const cookieValue = cookies[ephemeralCookie]
  const expectedValue = ephemeralCookieValue(requestUri)
  return expectedValue === cookieValue
}

/**
 * Clears all the temporary session cookies that were created in the context of
 * a particular request.
 */
function clearSessionCookies(
  req: IncomingMessage,
  res: ServerResponse,
  requestUri: RequestUri,
) {
  // Clear every cookie secret that were created for this request.
  for (const cookieName of extractEphemeralCookies(req, requestUri)) {
    clearCookie(res, cookieName, EPHEMERAL_COOKIE_OPTIONS)
  }
}

function extractEphemeralCookies(
  req: IncomingMessage,
  requestUri: RequestUri | undefined,
) {
  const cookies = parseHttpCookies(req)
  const expectedValue = ephemeralCookieValue(requestUri)
  return Object.entries(cookies)
    .filter(([, cookieValue]) => cookieValue === expectedValue)
    .map(([cookieName]) => cookieName)
}

function buildRedirectUrl(
  iss: string,
  parameters: OAuthAuthorizationRequestParameters,
  redirect: AuthorizationRedirectParameters,
): string {
  const url = new URL('/oauth/authorize/redirect', iss)

  url.searchParams.set('redirect_mode', buildRedirectUri(parameters))
  url.searchParams.set('redirect_uri', buildRedirectUri(parameters))

  for (const [key, value] of buildRedirectEntries(iss, parameters, redirect)) {
    url.searchParams.set(key, value)
  }

  return url.href
}

export function parseRedirectUrl(url: URL): OAuthRedirectOptions {
  if (url.pathname !== '/oauth/authorize/redirect') {
    throw new InvalidRequestError(
      `Invalid redirect URL: ${url.pathname} is not a valid path`,
    )
  }

  const params: [OAuthRedirectQueryParameter, string][] = []

  if (url.searchParams.has('code')) {
    for (const key of SUCCESS_REDIRECT_KEYS) {
      const value = url.searchParams.get(key)
      if (value != null) params.push([key, value])
    }
  } else if (url.searchParams.has('error')) {
    for (const key of ERROR_REDIRECT_KEYS) {
      const value = url.searchParams.get(key)
      if (value != null) params.push([key, value])
    }
  } else {
    throw new InvalidRequestError(
      'Invalid redirect URL: neither code nor error found',
    )
  }

  try {
    const mode: OAuthResponseMode = oauthResponseModeSchema.parse(
      url.searchParams.get('redirect_mode'),
    )

    const redirectUri: OAuthRedirectUri = oauthRedirectUriSchema.parse(
      url.searchParams.get('redirect_uri'),
    )

    return { mode, redirectUri, params }
  } catch (err) {
    throw InvalidRequestError.from(err, 'Invalid redirect URL')
  }
}

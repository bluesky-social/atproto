import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { z } from 'zod'
import {
  API_ENDPOINT_PREFIX,
  Account,
  ActiveAccountSession,
  ActiveDeviceSession,
  ActiveOAuthSession,
  ApiEndpoints,
  ISODateString,
} from '@atproto/oauth-provider-api'
import {
  OAuthAuthorizationRequestParameters,
  OAuthRedirectUri,
  OAuthResponseMode,
  oauthRedirectUriSchema,
  oauthResponseModeSchema,
} from '@atproto/oauth-types'
import { AuthorizedClients } from '../account/account-store.js'
import { signInDataSchema } from '../account/sign-in-data.js'
import { signUpInputSchema } from '../account/sign-up-input.js'
import { DeviceId, deviceIdSchema } from '../device/device-id.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { buildErrorPayload, buildErrorStatus } from '../errors/error-parser.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { LoginRequiredError } from '../errors/login-required-error.js'
import {
  Middleware,
  RequestMetadata,
  Router,
  RouterCtx,
  SubCtx,
  jsonHandler,
  parseHttpRequest,
  subCtx,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferrer,
} from '../lib/http/index.js'
import { RouteCtx, createRoute } from '../lib/http/route.js'
import { asArray } from '../lib/util/cast.js'
import { dateToEpoch } from '../lib/util/date.js'
import { localeSchema } from '../lib/util/locale.js'
import type { Awaitable } from '../lib/util/type.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { subSchema } from '../oidc/sub.js'
import { RequestInfo } from '../request/request-info.js'
import { RequestUri, requestUriSchema } from '../request/request-uri.js'
import { AuthorizationRedirectParameters } from '../result/authorization-redirect-parameters.js'
import { tokenIdSchema } from '../token/token-id.js'
import { emailOtpSchema } from '../types/email-otp.js'
import { emailSchema } from '../types/email.js'
import { handleSchema } from '../types/handle.js'
import { newPasswordSchema } from '../types/password.js'
import { validateCsrfToken } from './csrf.js'
import type { RouterOptions } from './router-options.js'
import {
  ERROR_REDIRECT_KEYS,
  OAuthRedirectOptions,
  OAuthRedirectQueryParameter,
  SUCCESS_REDIRECT_KEYS,
  buildRedirectMode,
  buildRedirectParams,
  buildRedirectUri,
} from './send-redirect.js'

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
      const { deviceId, deviceMetadata } = await server.deviceManager.load(
        req,
        res,
        true,
      )

      const remember = !this.requestUri

      const account = await server.accountManager.createAccount(
        deviceId,
        deviceMetadata,
        this.input,
      )

      // Only "remember" the newly created account if it was not created during an
      // OAuth flow.
      if (remember) {
        await server.accountManager.addDeviceAccount(deviceId, account.sub)
      }

      const token = remember
        ? undefined
        : await server.signer.createApiToken({
            sub: account.sub,
            aud: `${server.issuer}${API_ENDPOINT_PREFIX}`,
            exp: dateToEpoch(new Date(Date.now() + 5 * 60 * 1000)),
            requestUri: this.requestUri,
          })

      return { account, token }
    }),
  )

  router.use(
    apiRoute('POST', '/sign-in', signInDataSchema, async function (req, res) {
      const { deviceId, deviceMetadata } = await server.deviceManager.load(
        req,
        res,
        true,
      )

      const account = await server.accountManager.authenticateAccount(
        deviceId,
        deviceMetadata,
        this.input,
      )

      if (this.input.remember) {
        await server.accountManager.addDeviceAccount(deviceId, account.sub)
      } else {
        // If the user was already signed in, and signed in again, this time
        // without "remember me", let's log them out from the device.
        await server.accountManager.removeDeviceAccount(deviceId, account.sub)
      }

      const token = this.input.remember
        ? undefined
        : await server.signer.createApiToken({
            sub: account.sub,
            aud: `${server.issuer}${API_ENDPOINT_PREFIX}`,
            exp: dateToEpoch(new Date(Date.now() + 5 * 60 * 1000)),
            requestUri: this.requestUri,
          })

      if (this.requestUri) {
        // Check if a consent is required for the client, but only if this
        // call is made within the context of an oauth request.

        const { clientId, parameters } = await server.requestManager.get(
          this.requestUri,
          deviceId,
        )

        const { authorizedClients } = await server.accountManager.getAccount(
          account.sub,
        )

        return {
          account,
          token,
          consentRequired: server.checkConsentRequired(
            parameters,
            authorizedClients.get(clientId),
          ),
        }
      }

      return { account, token }
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
          await server.accountManager.removeDeviceAccount(deviceId, sub)
        }

        return { success: true as const }
      },
    ),
  )

  router.use(
    apiRoute(
      'POST',
      '/reset-password-request',
      z
        .object({
          locale: localeSchema,
          email: emailSchema,
        })
        .strict(),
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
      z
        .object({
          token: emailOtpSchema,
          password: newPasswordSchema,
        })
        .strict(),
      async function () {
        await server.accountManager.resetPasswordConfirm(this.input)
        return { success: true }
      },
    ),
  )

  router.use(
    apiRoute('GET', '/device-sessions', undefined, async function (req, res) {
      const { deviceId } = await server.deviceManager.load(req, res)

      const deviceAccounts =
        await server.accountManager.listDeviceAccounts(deviceId)

      return {
        results: deviceAccounts.map(
          (deviceAccount): ActiveDeviceSession => ({
            account: deviceAccount.account,
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
        const { account } = await authenticate(
          req,
          res,
          this.input.sub,
          this.requestUri,
        )

        const tokenInfos = await server.tokenManager.listAccountTokens(
          account.sub,
        )

        const clientIds = tokenInfos.map((tokenInfo) => tokenInfo.data.clientId)

        const clients = await server.clientManager.loadClients(clientIds, {
          onError: (err, clientId) => {
            onError?.(req, res, err, `Failed to load client ${clientId}`)
            return undefined // metadata won't be available in the UI
          },
        })

        return {
          // @TODO: We should ideally filter sessions that are expired (or even
          // expose the expiration date). This requires a change to the way
          // TokenInfo are stored (see TokenManager#isTokenExpired and
          // TokenManager#isTokenInactive).
          results: tokenInfos.map(({ id, data }): ActiveOAuthSession => {
            return {
              tokenId: id,

              createdAt: data.createdAt.toISOString() as ISODateString,
              updatedAt: data.updatedAt.toISOString() as ISODateString,

              clientId: data.clientId,
              clientMetadata: clients.get(data.clientId)?.metadata,

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
        const { deviceId, account } = await authenticate(
          req,
          res,
          this.input.sub,
          this.requestUri,
        )

        const deviceAccounts = await server.accountManager.listAccountDevices(
          account.sub,
        )

        return {
          results: deviceAccounts.map(
            (accountSession): ActiveAccountSession => ({
              deviceId: accountSession.deviceId,
              deviceMetadata: {
                ipAddress: accountSession.deviceData.ipAddress,
                userAgent: accountSession.deviceData.userAgent,
                lastSeenAt:
                  accountSession.deviceData.lastSeenAt.toISOString() as ISODateString,
              },

              isCurrentDevice: accountSession.deviceId === deviceId,
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

        await server.accountManager.removeDeviceAccount(
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
      '/revoke-oauth-session',
      z.object({ sub: subSchema, tokenId: tokenIdSchema }).strict(),
      async function (req, res) {
        const { account } = await authenticate(
          req,
          res,
          this.input.sub,
          this.requestUri,
          true,
        )

        const tokenInfo = await server.tokenManager.getTokenInfo(
          this.input.tokenId,
        )

        if (tokenInfo.account.sub !== account.sub) {
          // report this as though the token was not found
          throw new InvalidRequestError(`Invalid token`)
        }

        await server.tokenManager.deleteToken(tokenInfo.id)

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
          const {
            deviceId,
            deviceMetadata,
            account,
            authorizedClients,
            requestInfo,
          } = await authenticate(req, res, this.input.sub, requestUri, true)

          const { clientId, parameters } = requestInfo

          // Any error thrown in this block will be transformed into an
          // AccessDeniedError in order to allow redirecting the user to the
          // client.
          try {
            const client = await server.clientManager.getClient(clientId)

            const code = await server.requestManager.setAuthorized(
              requestInfo.uri,
              client,
              account,
              deviceId,
              deviceMetadata,
            )

            const clientData = authorizedClients.get(clientId)
            if (server.checkConsentRequired(parameters, clientData)) {
              const scopes = new Set(clientData?.authorizedScopes)

              // Add the newly accepted scopes to the authorized scopes

              // @NOTE `oauthScopeSchema` ensures that `scope` contains no
              // leading/trailing/duplicate spaces.
              for (const s of parameters.scope?.split(' ') ?? []) scopes.add(s)

              await server.accountManager.setAuthorizedClient(account, client, {
                ...clientData,
                authorizedScopes: [...scopes],
              })
            }

            const url = buildRedirectUrl(server.issuer, parameters, { code })

            return { url }
          } catch (err) {
            throw AccessDeniedError.from(parameters, err, 'server_error')
          }
        } catch (err) {
          // If any error happened (unauthenticated, invalid request, etc.),
          // lets make sure the request can no longer be used.
          try {
            await server.requestManager.delete(requestUri)
          } catch (err) {
            onError?.(req, res, err, 'Failed to delete request')
          }

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
    account: Account
    authorizedClients: AuthorizedClients
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
    account: Account
    authorizedClients: AuthorizedClients
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
    account: Account
    authorizedClients: AuthorizedClients
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

    // TODO: CHeck if request has signedApiToken here !!!

    // Ensures the requested "sub" is linked to the device
    const { account, authorizedClients } = await server.accountManager
      .getDeviceAccount(deviceId, sub)
      .then(
        (deviceAccount) => {
          // The session exists but was created too long ago
          if (server.checkLoginRequired(deviceAccount)) {
            const message = 'Login required'
            throw requestInfo
              ? new LoginRequiredError(requestInfo.parameters, message)
              : new InvalidRequestError(message)
          }

          return deviceAccount
        },
        (err) => {
          throw requestInfo //
            ? LoginRequiredError.from(requestInfo.parameters, err)
            : err
        },
      )

    return { deviceId, deviceMetadata, account, authorizedClients, requestInfo }
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
        const referrer = validateReferrer(req, { origin: issuerOrigin })

        // Ensure we are one the right page
        if (
          // trailing slashes are not allowed
          referrer.pathname !== '/oauth/authorize' &&
          referrer.pathname !== '/account' &&
          !referrer.pathname.startsWith(`/account/`)
        ) {
          throw createHttpError(400, `Invalid referrer ${referrer}`)
        }

        // Check if the request originated from the authorize page
        const requestUri =
          referrer.pathname === '/oauth/authorize'
            ? await requestUriSchema.parseAsync(
                referrer.searchParams.get('request_uri'),
              )
            : undefined

        // Validate CSRF token
        await validateCsrfToken(req, res)

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

function buildRedirectUrl(
  iss: string,
  parameters: OAuthAuthorizationRequestParameters,
  redirect: AuthorizationRedirectParameters,
): string {
  const url = new URL('/oauth/authorize/redirect', iss)

  url.searchParams.set('redirect_mode', buildRedirectMode(parameters))
  url.searchParams.set('redirect_uri', buildRedirectUri(parameters))

  for (const [key, value] of buildRedirectParams(iss, parameters, redirect)) {
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

  const state = url.searchParams.get('state')
  if (state) params.push(['state', state])

  const iss = url.searchParams.get('iss')
  if (iss) params.push(['iss', iss])

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

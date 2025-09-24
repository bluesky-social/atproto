import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { z } from 'zod'
import { signedJwtSchema } from '@atproto/jwk'
import {
  API_ENDPOINT_PREFIX,
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
import { signInDataSchema } from '../account/sign-in-data.js'
import { signUpInputSchema } from '../account/sign-up-input.js'
import { DeviceId, deviceIdSchema } from '../device/device-id.js'
import { AuthorizationError } from '../errors/authorization-error.js'
import {
  ErrorPayload,
  buildErrorPayload,
  buildErrorStatus,
} from '../errors/error-parser.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { WWWAuthenticateError } from '../errors/www-authenticate-error.js'
import {
  JsonResponse,
  Middleware,
  RequestMetadata,
  Router,
  RouterCtx,
  SubCtx,
  flushStream,
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
import { localeSchema } from '../lib/util/locale.js'
import type { Awaitable } from '../lib/util/type.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { Sub, subSchema } from '../oidc/sub.js'
import { RequestUri, requestUriSchema } from '../request/request-uri.js'
import { AuthorizationRedirectParameters } from '../result/authorization-redirect-parameters.js'
import { tokenIdSchema } from '../token/token-id.js'
import { emailOtpSchema } from '../types/email-otp.js'
import { emailSchema } from '../types/email.js'
import { handleSchema } from '../types/handle.js'
import { newPasswordSchema } from '../types/password.js'
import { validateCsrfToken } from './assets/csrf.js'
import type { MiddlewareOptions } from './middleware-options.js'
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

export function createApiMiddleware<
  Ctx extends object | void = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  { onError }: MiddlewareOptions<Req, Res>,
): Middleware<Ctx, Req, Res> {
  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin
  const router = new Router<Ctx, Req, Res>(issuerUrl)

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/verify-handle-availability',
      schema: verifyHandleSchema,
      async handler() {
        await server.accountManager.verifyHandleAvailability(this.input.handle)
        return { json: { available: true } }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/sign-up',
      schema: signUpInputSchema,
      rotateDeviceCookies: true,
      async handler() {
        const { deviceId, deviceMetadata, input, requestUri } = this

        const account = await server.accountManager.createAccount(
          deviceId,
          deviceMetadata,
          input,
        )

        // Remember when not in the context of a request by default
        const remember = requestUri == null

        // Only "remember" the newly created account if it was not created during an
        // OAuth flow.
        if (remember) {
          await server.accountManager.upsertDeviceAccount(deviceId, account.sub)
        }

        const ephemeralToken = remember
          ? undefined
          : await server.signer.createEphemeralToken({
              sub: account.sub,
              deviceId,
              requestUri: this.requestUri,
            })

        const json = { account, ephemeralToken }
        return { json }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/sign-in',
      schema: signInDataSchema.extend({ remember: z.boolean().optional() }),
      rotateDeviceCookies: true,
      async handler() {
        const { deviceId, deviceMetadata, requestUri } = this

        // Remember when not in the context of a request by default
        const { remember = requestUri == null, ...input } = this.input

        const account = await server.accountManager.authenticateAccount(
          deviceId,
          deviceMetadata,
          input,
        )

        if (remember) {
          await server.accountManager.upsertDeviceAccount(deviceId, account.sub)
        } else {
          // In case the user was already signed in, and signed in again, this
          // time without "remember me", let's sign them off of the device.
          await server.accountManager.removeDeviceAccount(deviceId, account.sub)
        }

        const ephemeralToken = remember
          ? undefined
          : await server.signer.createEphemeralToken({
              sub: account.sub,
              deviceId,
              requestUri,
            })

        if (requestUri) {
          // Check if a consent is required for the client, but only if this
          // call is made within the context of an oauth request.

          const { clientId, parameters } = await server.requestManager.get(
            requestUri,
            deviceId,
          )

          const { authorizedClients } = await server.accountManager.getAccount(
            account.sub,
          )

          const json = {
            account,
            ephemeralToken,
            consentRequired: server.checkConsentRequired(
              parameters,
              authorizedClients.get(clientId),
            ),
          }

          return { json }
        }

        const json = { account, ephemeralToken }
        return { json }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/sign-out',
      schema: z
        .object({
          sub: z.union([subSchema, z.array(subSchema)]),
        })
        .strict(),
      rotateDeviceCookies: true,
      async handler() {
        const uniqueSubs = new Set(asArray(this.input.sub))

        for (const sub of uniqueSubs) {
          await server.accountManager.removeDeviceAccount(this.deviceId, sub)
        }

        return { json: { success: true as const } }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/reset-password-request',
      schema: z
        .object({
          locale: localeSchema,
          email: emailSchema,
        })
        .strict(),
      async handler() {
        await server.accountManager.resetPasswordRequest(
          this.deviceId,
          this.deviceMetadata,
          this.input,
        )
        return { json: { success: true } }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/reset-password-confirm',
      schema: z
        .object({
          token: emailOtpSchema,
          password: newPasswordSchema,
        })
        .strict(),
      async handler() {
        await server.accountManager.resetPasswordConfirm(
          this.deviceId,
          this.deviceMetadata,
          this.input,
        )
        return { json: { success: true } }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'GET',
      endpoint: '/device-sessions',
      schema: undefined,
      async handler() {
        const deviceAccounts = await server.accountManager.listDeviceAccounts(
          this.deviceId,
        )

        const json = deviceAccounts.map(
          (deviceAccount): ActiveDeviceSession => ({
            account: deviceAccount.account,
            loginRequired: server.checkLoginRequired(deviceAccount),
          }),
        )

        return { json }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'GET',
      endpoint: '/oauth-sessions',
      schema: z.object({ sub: subSchema }).strict(),
      async handler(req, res) {
        const { account } = await authenticate.call(this, req, res)

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

        // @TODO: We should ideally filter sessions that are expired (or even
        // expose the expiration date). This requires a change to the way
        // TokenInfo are stored (see TokenManager#isTokenExpired and
        // TokenManager#isTokenInactive).
        const json = tokenInfos.map(({ id, data }): ActiveOAuthSession => {
          return {
            tokenId: id,

            createdAt: data.createdAt.toISOString() as ISODateString,
            updatedAt: data.updatedAt.toISOString() as ISODateString,

            clientId: data.clientId,
            clientMetadata: clients.get(data.clientId)?.metadata,

            scope: data.parameters.scope,
          }
        })

        return { json }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'GET',
      endpoint: '/account-sessions',
      schema: z.object({ sub: subSchema }).strict(),
      async handler(req, res) {
        const { account } = await authenticate.call(this, req, res)

        const deviceAccounts = await server.accountManager.listAccountDevices(
          account.sub,
        )

        const json = deviceAccounts.map(
          (accountSession): ActiveAccountSession => ({
            deviceId: accountSession.deviceId,
            deviceMetadata: {
              ipAddress: accountSession.deviceData.ipAddress,
              userAgent: accountSession.deviceData.userAgent,
              lastSeenAt:
                accountSession.deviceData.lastSeenAt.toISOString() as ISODateString,
            },

            isCurrentDevice: accountSession.deviceId === this.deviceId,
          }),
        )

        return { json }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/revoke-account-session',
      schema: z.object({ sub: subSchema, deviceId: deviceIdSchema }).strict(),
      async handler() {
        // @NOTE This route is not authenticated. If a user is able to steal
        // another user's session cookie, we allow them to revoke the device
        // session.

        await server.accountManager.removeDeviceAccount(
          this.input.deviceId,
          this.input.sub,
        )

        return { json: { success: true } }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/revoke-oauth-session',
      schema: z.object({ sub: subSchema, tokenId: tokenIdSchema }).strict(),
      async handler(req, res) {
        const { account } = await authenticate.call(this, req, res)

        const tokenInfo = await server.tokenManager.getTokenInfo(
          this.input.tokenId,
        )

        if (!tokenInfo || tokenInfo.account.sub !== account.sub) {
          // report this as though the token was not found
          throw new InvalidRequestError(`Invalid token`)
        }

        await server.tokenManager.deleteToken(tokenInfo.id)

        return { json: { success: true } }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/consent',
      schema: z
        .object({
          sub: z.union([subSchema, signedJwtSchema]),
          scope: z.string().optional(),
        })
        .strict(),
      async handler(req, res) {
        if (!this.requestUri) {
          throw new InvalidRequestError(
            'This endpoint can only be used in the context of an OAuth request',
          )
        }

        // Any AuthorizationError caught in this block will result in a redirect
        // to the client's redirect_uri with an error.
        try {
          const { clientId, parameters } = await server.requestManager.get(
            this.requestUri,
            this.deviceId,
          )

          // Any error thrown in this block will be transformed into an
          // AuthorizationError.
          try {
            const { account, authorizedClients } = await authenticate.call(
              this,
              req,
              res,
            )

            const client = await server.clientManager.getClient(clientId)

            const code = await server.requestManager.setAuthorized(
              this.requestUri,
              client,
              account,
              this.deviceId,
              this.deviceMetadata,
              this.input.scope,
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

            return { json: { url } }
          } catch (err) {
            // Since we have access to the parameters, we can re-throw an
            // AuthorizationError with the redirect_uri parameter.
            throw AuthorizationError.from(parameters, err)
          }
        } catch (err) {
          onError?.(req, res, err, 'Failed to consent authorization request')

          // If any error happened (unauthenticated, invalid request, etc.),
          // lets make sure the request can no longer be used.
          try {
            await server.requestManager.delete(this.requestUri)
          } catch (err) {
            onError?.(req, res, err, 'Failed to delete request')
          }

          if (err instanceof AuthorizationError) {
            try {
              const url = buildRedirectUrl(
                server.issuer,
                err.parameters,
                err.toJSON(),
              )

              return { json: { url } }
            } catch {
              // Unable to build redirect URL, ignore
            }
          }

          // @NOTE Not re-throwing the error here, as the error was already
          // handled by the `onError` callback, and apiRoute (`apiMiddleware`)
          // would call `onError` again.
          return buildErrorJsonResponse(err)
        }
      },
    }),
  )

  router.use(
    apiRoute({
      method: 'POST',
      endpoint: '/reject',
      schema: z.object({}).strict(),
      rotateDeviceCookies: true,
      async handler(req, res) {
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

          const { parameters } = await server.requestManager.get(
            requestUri,
            this.deviceId,
          )

          const url = buildRedirectUrl(server.issuer, parameters, {
            error: 'access_denied',
            error_description: 'The user rejected the request',
          })

          return { json: { url } }
        } catch (err) {
          onError?.(req, res, err, 'Failed to reject authorization request')

          if (err instanceof AuthorizationError) {
            try {
              const url = buildRedirectUrl(
                server.issuer,
                err.parameters,
                err.toJSON(),
              )

              return { json: { url } }
            } catch {
              // Unable to build redirect URL, ignore
            }
          }

          return buildErrorJsonResponse(err)
        } finally {
          await server.requestManager.delete(requestUri).catch((err) => {
            onError?.(req, res, err, 'Failed to delete request')
          })
        }
      },
    }),
  )

  return router.buildMiddleware()

  async function authenticate(
    this: ApiContext<void, { sub: Sub }>,
    req: Req,
    res: Res,
  ) {
    const authorization = req.headers.authorization?.split(' ')
    if (authorization?.[0].toLowerCase() === 'bearer') {
      try {
        // If there is an authorization header, verify that the ephemeral token it
        // contains is a jwt bound to the right [sub, device, request].
        const ephemeralToken = signedJwtSchema.parse(authorization[1])
        const { payload } =
          await server.signer.verifyEphemeralToken(ephemeralToken)

        if (
          payload.sub === this.input.sub &&
          payload.deviceId === this.deviceId &&
          payload.requestUri === this.requestUri
        ) {
          return await server.accountManager.getAccount(payload.sub)
        }
      } catch (err) {
        onError?.(req, res, err, 'Failed to authenticate ephemeral token')
        // Fall back to session based authentication
      }
    }

    try {
      // Ensures the "sub" has an active session on the device
      const deviceAccount = await server.accountManager.getDeviceAccount(
        this.deviceId,
        this.input.sub,
      )

      // The session exists but was created too long ago
      if (server.checkLoginRequired(deviceAccount)) {
        throw new InvalidRequestError('Login required')
      }

      return deviceAccount
    } catch (err) {
      throw new WWWAuthenticateError(
        'unauthorized',
        `User ${this.input.sub} not authenticated on this device`,
        { Bearer: {} },
        err,
      )
    }
  }

  type ApiContext<T extends object | void, I = void> = SubCtx<
    T,
    {
      deviceId: DeviceId
      deviceMetadata: RequestMetadata

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
    C extends RouterCtx<Ctx>,
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
  >(options: {
    method: M
    endpoint: E
    schema: S
    rotateDeviceCookies?: boolean
    handler: (
      this: ApiContext<RouteCtx<C>, InferValidation<S>>,
      req: Req,
      res: Res,
    ) => Awaitable<JsonResponse<ErrorPayload | ApiEndpoints[E]['output']>>
  }): Middleware<C, Req, Res> {
    return createRoute(
      options.method,
      `${API_ENDPOINT_PREFIX}${options.endpoint}`,
      apiMiddleware(options),
    )
  }

  function apiMiddleware<C extends RouterCtx, S extends void | z.ZodTypeAny>({
    method,
    schema,
    rotateDeviceCookies,
    handler,
  }: {
    method: 'GET' | 'POST'
    schema: S
    rotateDeviceCookies?: boolean
    handler: (
      this: ApiContext<C, InferValidation<S>>,
      req: Req,
      res: Res,
    ) => Awaitable<JsonResponse>
  }): Middleware<C, Req, Res> {
    const parseInput: (this: C, req: Req) => Promise<InferValidation<S>> =
      schema == null // No schema means endpoint doesn't accept any input
        ? async function (req) {
            await flushStream(req)
            return undefined
          }
        : method === 'POST'
          ? async function (req) {
              const body = await parseHttpRequest(req, ['json'])
              return schema.parseAsync(body, { path: ['body'] })
            }
          : async function (req) {
              await flushStream(req)
              const query = Object.fromEntries(this.url.searchParams)
              return schema.parseAsync(query, { path: ['query'] })
            }

    return jsonHandler<C, Req, Res>(async function (req, res) {
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

        // Load session data, rotating the session cookie if needed
        const { deviceId, deviceMetadata } = await server.deviceManager.load(
          req,
          res,
          rotateDeviceCookies,
        )

        const context: ApiContext<C, InferValidation<S>> = subCtx(this, {
          input,
          requestUri,
          deviceId,
          deviceMetadata,
        })

        return await handler.call(context, req, res)
      } catch (err) {
        onError?.(req, res, err, `Failed to handle API request`)

        // Make sore to always return a JSON response
        return buildErrorJsonResponse(err)
      }
    })
  }
}

function buildErrorJsonResponse(err: unknown) {
  // @TODO Rework the API error responses (relying on codes)
  const json = buildErrorPayload(err)
  const status = buildErrorStatus(err)

  return { json, status }
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

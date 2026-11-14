import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { didSchema } from '@atproto/did'
import {
  isLoopbackHost,
  isOAuthClientIdDiscoverable,
  isOAuthClientIdLoopback,
  oauthClientIdSchema,
} from '@atproto/oauth-types'
import {
  type Middleware,
  Router,
  appendHeader,
  cacheControlMiddleware,
  jsonHandler,
  parseHttpRequest,
  staticJsonMiddleware,
  validateFetchDest,
} from '../lib/http/index.js'
import type { OAuthProvider } from '../oauth-provider.js'
import type { MiddlewareOptions } from './middleware-options.js'

export const FEDCM_IDP_REGISTRATION_TYPE = 'https://atproto.com'

export function buildFedcmConfigUrl(issuer: string): string {
  return new URL('/oauth/fedcm/config.json', issuer).href
}

const assertionInputSchema = z.object({
  account_id: didSchema,
  client_id: oauthClientIdSchema,
  // @NOTE Chrome's encoding of `params` is unverified; parsed as a JSON string.
  params: z.string(),
})

const assertionParamsSchema = z
  .object({
    response_type: z.literal('id_token'),
    nonce: z.string().min(1).max(256),
  })
  .strict()

function parseAssertionParams(params: string) {
  try {
    return assertionParamsSchema.parse(JSON.parse(params))
  } catch {
    throw new FedcmEndpointError(400, 'invalid_request')
  }
}

type FedcmErrorCode =
  | 'invalid_request'
  | 'internal_error'
  | 'login_required'
  | 'unauthorized_client'

class FedcmEndpointError extends Error {
  name = 'FedcmEndpointError'

  constructor(
    public readonly status: number,
    public readonly code: FedcmErrorCode,
  ) {
    super(code)
  }
}

export function createFedcmMiddleware<
  Ctx extends object | void = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  { onError }: MiddlewareOptions<Req, Res>,
): Middleware<Ctx, Req, Res> {
  const fedcm = server.fedcm
  if (!fedcm) return (_req, _res, next) => void next()

  const issuerUrl = new URL(server.issuer)
  const configUrl = buildFedcmConfigUrl(server.issuer)
  const router = new Router<Ctx, Req, Res>(issuerUrl)

  // @NOTE IdP registration: Chrome skips this check for registered IdPs.
  router.get(
    '/.well-known/web-identity',
    cacheControlMiddleware(300),
    staticJsonMiddleware({ provider_urls: [configUrl] }),
  )

  router.get(
    '/oauth/fedcm/config.json',
    cacheControlMiddleware(300),
    staticJsonMiddleware({
      accounts_endpoint: new URL('/oauth/fedcm/accounts', issuerUrl).href,
      id_assertion_endpoint: new URL('/oauth/fedcm/assertion', issuerUrl).href,
      login_url: new URL('/account/sign-in?fedcm=true', issuerUrl).href,
      types: [FEDCM_IDP_REGISTRATION_TYPE],
    }),
  )

  // @NOTE IdP registration: Chrome never fetches this for registered IdPs,
  // which use pushed accounts.
  router.get(
    '/oauth/fedcm/accounts',
    fedcmJsonHandler(async (req) => {
      validateWebIdentityRequest(req)

      // @NOTE This must stay read-only and must not reflect Origin, which would
      // expose account data to arbitrary credentialed RP origins.
      // @NOTE IdP registration: this device read is unused for registered IdPs.
      const device = await server.deviceManager.readFedcmDevice(req)
      if (!device) throw new FedcmEndpointError(401, 'login_required')

      const accounts = await server.listFedcmAccounts(device.deviceId)
      if (!accounts.length) throw new FedcmEndpointError(401, 'login_required')

      return {
        // listFedcmAccounts only returns accounts with a handle.
        accounts: accounts.flatMap(({ account }) =>
          account.handle
            ? [
                {
                  id: account.did,
                  username: `@${account.handle}`,
                  ...(account.name ? { name: account.name } : {}),
                  ...(account.picture ? { picture: account.picture } : {}),
                },
              ]
            : [],
        ),
      }
    }),
  )

  router.post(
    '/oauth/fedcm/assertion',
    fedcmJsonHandler(async (req, res) => {
      validateWebIdentityRequest(req)

      const payload = await parseHttpRequest(req, ['urlencoded']).catch(() => {
        throw new FedcmEndpointError(400, 'invalid_request')
      })
      const parsedPayload = assertionInputSchema.safeParse(payload)
      if (!parsedPayload.success) {
        throw new FedcmEndpointError(400, 'invalid_request')
      }
      const { account_id, client_id, params } = parsedPayload.data
      const { nonce } = parseAssertionParams(params)

      const isDiscoverableClient = isOAuthClientIdDiscoverable(client_id)
      const isLoopbackClient = isOAuthClientIdLoopback(client_id)
      if (!isDiscoverableClient && !isLoopbackClient) {
        throw new FedcmEndpointError(403, 'unauthorized_client')
      }
      if (isLoopbackClient && !fedcm.allowLoopbackClients) {
        throw new FedcmEndpointError(403, 'unauthorized_client')
      }

      const origin = parseRequestOrigin(
        req,
        isLoopbackClient && fedcm.allowLoopbackClients,
      )

      if (isDiscoverableClient) {
        if (origin !== new URL(client_id).origin) {
          throw new FedcmEndpointError(403, 'unauthorized_client')
        }
      }

      const client = await server.clientManager
        .getClient(client_id)
        .catch(() => {
          throw new FedcmEndpointError(403, 'unauthorized_client')
        })

      if (isLoopbackClient) {
        const allowedOrigins = client.metadata.redirect_uris.flatMap((uri) => {
          try {
            const url = new URL(uri)
            return url.protocol === 'http:' && isLoopbackHost(url.hostname)
              ? [url.origin]
              : []
          } catch {
            return []
          }
        })
        if (!allowedOrigins.includes(origin)) {
          throw new FedcmEndpointError(403, 'unauthorized_client')
        }
      }

      setCorsOrigin(res, origin)

      const device = await server.deviceManager.readFedcmDevice(req)
      if (!device) throw new FedcmEndpointError(401, 'login_required')

      const accounts = await server.listFedcmAccounts(device.deviceId)
      const deviceAccount = accounts.find(
        ({ account }) => account.did === account_id,
      )
      if (!deviceAccount) throw new FedcmEndpointError(401, 'login_required')

      return {
        token: await server.createFedcmIdToken(deviceAccount, client_id, nonce),
      }
    }),
  )

  return router.buildMiddleware()

  function fedcmJsonHandler(
    buildResponse: (req: Req, res: Res) => unknown | Promise<unknown>,
  ) {
    return jsonHandler<unknown, Req, Res>(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')
      ensureVaryOrigin(res)

      try {
        return { json: await buildResponse(req, res) }
      } catch (err) {
        if (!(err instanceof FedcmEndpointError)) {
          onError?.(req, res, err, 'FedCM endpoint failed')
        }
        const error =
          err instanceof FedcmEndpointError
            ? err
            : new FedcmEndpointError(500, 'internal_error')
        return {
          json: { error: { code: error.code } },
          status: error.status,
        }
      }
    })
  }
}

function validateWebIdentityRequest(req: IncomingMessage): void {
  try {
    validateFetchDest(req, ['webidentity'])
  } catch {
    throw new FedcmEndpointError(400, 'invalid_request')
  }
}

function parseRequestOrigin(
  req: IncomingMessage,
  allowLoopbackClients = false,
): string {
  const rawOrigin = req.headers.origin
  if (typeof rawOrigin !== 'string') {
    throw new FedcmEndpointError(400, 'invalid_request')
  }

  try {
    const origin = new URL(rawOrigin)
    if (
      origin.origin !== rawOrigin ||
      origin.username ||
      origin.password ||
      (origin.protocol !== 'https:' &&
        !(
          allowLoopbackClients &&
          origin.protocol === 'http:' &&
          isLoopbackHost(origin.hostname)
        ))
    ) {
      throw new Error('Invalid origin')
    }
    return origin.origin
  } catch {
    throw new FedcmEndpointError(400, 'invalid_request')
  }
}

function ensureVaryOrigin(res: ServerResponse): void {
  const existing = res.getHeader('Vary')
  if (existing == null) {
    res.setHeader('Vary', 'Origin')
  } else {
    const values = Array.isArray(existing) ? existing : [String(existing)]
    if (
      !values.some((value) =>
        value.split(',').some((part) => part.trim().toLowerCase() === 'origin'),
      )
    ) {
      appendHeader(res, 'Vary', 'Origin')
    }
  }
}

function setCorsOrigin(res: ServerResponse, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

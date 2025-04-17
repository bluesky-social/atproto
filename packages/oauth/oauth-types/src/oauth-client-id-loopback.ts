import { TypeOf, ZodIssueCode } from 'zod'
import { oauthClientIdSchema } from './oauth-client-id.js'
import {
  OAuthLoopbackRedirectURI,
  OAuthRedirectUri,
  oauthLoopbackRedirectURISchema,
} from './oauth-redirect-uri.js'
import { OAuthScope, oauthScopeSchema } from './oauth-scope.js'

const PREFIX = 'http://localhost'

export const oauthClientIdLoopbackSchema = oauthClientIdSchema.superRefine(
  (value, ctx): value is `${typeof PREFIX}${'' | '/'}${'' | `?${string}`}` => {
    try {
      assertOAuthLoopbackClientId(value)
      return true
    } catch (error) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          error instanceof TypeError
            ? error.message
            : 'Invalid loopback client ID',
      })
      return false
    }
  },
)

export type OAuthClientIdLoopback = TypeOf<typeof oauthClientIdLoopbackSchema>

export function isOAuthClientIdLoopback(
  clientId: string,
): clientId is OAuthClientIdLoopback {
  try {
    parseOAuthLoopbackClientId(clientId)
    return true
  } catch {
    return false
  }
}

export function assertOAuthLoopbackClientId(
  clientId: string,
): asserts clientId is OAuthClientIdLoopback {
  void parseOAuthLoopbackClientId(clientId)
}

// @TODO should we turn this into a zod schema? (more coherent error with other
// validation functions)
export function parseOAuthLoopbackClientId(clientId: string): {
  scope?: OAuthScope
  redirect_uris?: [OAuthRedirectUri, ...OAuthRedirectUri[]]
} {
  if (!clientId.startsWith(PREFIX)) {
    throw new TypeError(`Loopback ClientID must start with "${PREFIX}"`)
  } else if (clientId.includes('#', PREFIX.length)) {
    throw new TypeError('Loopback ClientID must not contain a hash component')
  }

  const queryStringIdx =
    clientId.length > PREFIX.length && clientId[PREFIX.length] === '/'
      ? PREFIX.length + 1
      : PREFIX.length

  if (clientId.length === queryStringIdx) {
    return {} // no query string to parse
  }

  if (clientId[queryStringIdx] !== '?') {
    throw new TypeError('Loopback ClientID must not contain a path component')
  }

  const searchParams = new URLSearchParams(clientId.slice(queryStringIdx + 1))

  for (const name of searchParams.keys()) {
    if (name !== 'redirect_uri' && name !== 'scope') {
      throw new TypeError(`Invalid query parameter "${name}" in client ID`)
    }
  }

  const scope = searchParams.get('scope') ?? undefined
  if (scope != null) {
    if (searchParams.getAll('scope').length > 1) {
      throw new TypeError(
        'Loopback ClientID must contain at most one scope query parameter',
      )
    } else if (!oauthScopeSchema.safeParse(scope).success) {
      throw new TypeError('Invalid scope query parameter in client ID')
    }
  }

  const redirect_uris = searchParams.has('redirect_uri')
    ? (searchParams
        .getAll('redirect_uri')
        .map((value) => oauthLoopbackRedirectURISchema.parse(value)) as [
        OAuthLoopbackRedirectURI,
        ...OAuthLoopbackRedirectURI[],
      ])
    : undefined

  return {
    scope,
    redirect_uris,
  }
}

import { oauthClientIdSchema } from './oauth-client-id.js'
import {
  OAuthLoopbackRedirectURI,
  oauthLoopbackClientRedirectUriSchema,
} from './oauth-redirect-uri.js'
import { OAuthScope, oauthScopeSchema } from './oauth-scope.js'

export const LOOPBACK_CLIENT_ID_ORIGIN = 'http://localhost'

// @NOTE This is not actually based on a standard, but rather a convention
// established by Bluesky in the Atproto specs and implementation. As such, and
// in order to respect the convention from this package, these should be
// prefixed with "Atproto" instead of "OAuth". For legacy reasons, we keep the
// current names, but we should rename them in a future major release, unless
// loopback client ids have since then been standardized.

export type OAuthClientIdLoopback =
  `http://localhost${'' | `/`}${'' | `?${string}`}`

export type OAuthLoopbackClientIdParams = {
  scope?: OAuthScope
  redirect_uris?: [OAuthLoopbackRedirectURI, ...OAuthLoopbackRedirectURI[]]
}

export const oauthClientIdLoopbackSchema = oauthClientIdSchema.superRefine(
  (input, ctx): input is OAuthClientIdLoopback => {
    const result = safeParseOAuthLoopbackClientId(input)
    if (!result.success) {
      ctx.addIssue({ code: 'custom', message: result.message })
    }
    return result.success
  },
)

export function assertOAuthLoopbackClientId(
  input: string,
): asserts input is OAuthClientIdLoopback {
  void parseOAuthLoopbackClientId(input)
}

export function isOAuthClientIdLoopback<T extends string>(
  input: T,
): input is T & OAuthClientIdLoopback {
  return safeParseOAuthLoopbackClientId(input).success
}

export function asOAuthClientIdLoopback<T extends string>(input: T) {
  assertOAuthLoopbackClientId(input)
  return input
}

export function parseOAuthLoopbackClientId(
  input: string,
): OAuthLoopbackClientIdParams {
  const result = safeParseOAuthLoopbackClientId(input)
  if (result.success) return result.value

  throw new TypeError(`Invalid loopback client ID: ${result.message}`)
}

/**
 * Similar to Zod's {@link SafeParseReturnType} but uses a simple "message"
 * string instead of an "error" Error object.
 */
type LightParseReturnType<T> =
  | { success: true; value: T }
  | { success: false; message: string }

export function safeParseOAuthLoopbackClientId(
  input: string,
): LightParseReturnType<OAuthLoopbackClientIdParams> {
  // @NOTE Not using "new URL" to ensure input indeed matches the type
  // OAuthClientIdLoopback

  if (!input.startsWith(LOOPBACK_CLIENT_ID_ORIGIN)) {
    return {
      success: false,
      message: `Value must start with "${LOOPBACK_CLIENT_ID_ORIGIN}"`,
    }
  }

  if (input.includes('#', LOOPBACK_CLIENT_ID_ORIGIN.length)) {
    return {
      success: false,
      message: 'Value must not contain a hash component',
    }
  }

  // Since we don't allow a path component (except for a single "/") the query
  // string starts after the origin (+ 1 if there is a "/")
  const queryStringIdx =
    input.length > LOOPBACK_CLIENT_ID_ORIGIN.length &&
    input.charCodeAt(LOOPBACK_CLIENT_ID_ORIGIN.length) === 0x2f /* '/' */
      ? LOOPBACK_CLIENT_ID_ORIGIN.length + 1
      : LOOPBACK_CLIENT_ID_ORIGIN.length

  // Since we determined the position of the query string based on the origin
  // length (instead of looking for a "?"), we need to make sure the query
  // string position (if any) indeed starts with a "?".
  if (
    input.length !== queryStringIdx &&
    input.charCodeAt(queryStringIdx) !== 0x3f /* '?' */
  ) {
    return {
      success: false,
      message: 'Value must not contain a path component',
    }
  }

  const queryString = input.slice(queryStringIdx + 1)
  return safeParseOAuthLoopbackClientIdQueryString(queryString)
}

export function safeParseOAuthLoopbackClientIdQueryString(
  input: string | Iterable<[key: string, value: string]>,
): LightParseReturnType<OAuthLoopbackClientIdParams> {
  // Parse query params
  const params: OAuthLoopbackClientIdParams = {}

  const it = typeof input === 'string' ? new URLSearchParams(input) : input
  for (const [key, value] of it) {
    if (key === 'scope') {
      if ('scope' in params) {
        return {
          success: false,
          message: 'Duplicate "scope" query parameter',
        }
      }

      const res = oauthScopeSchema.safeParse(value)
      if (!res.success) {
        const reason = res.error.issues.map((i) => i.message).join(', ')
        return {
          success: false,
          message: `Invalid "scope" query parameter: ${reason || 'Validation failed'}`,
        }
      }

      params.scope = res.data
    } else if (key === 'redirect_uri') {
      const res = oauthLoopbackClientRedirectUriSchema.safeParse(value)
      if (!res.success) {
        const reason = res.error.issues.map((i) => i.message).join(', ')
        return {
          success: false,
          message: `Invalid "redirect_uri" query parameter: ${reason || 'Validation failed'}`,
        }
      }

      if (params.redirect_uris == null) params.redirect_uris = [res.data]
      else params.redirect_uris.push(res.data)
    } else {
      return {
        success: false,
        message: `Unexpected query parameter "${key}"`,
      }
    }
  }

  return {
    success: true,
    value: params,
  }
}

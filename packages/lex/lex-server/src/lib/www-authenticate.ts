/**
 * Type representing the value of a WWW-Authenticate HTTP header.
 *
 * Supports multiple authentication schemes, each with optional parameters.
 * Parameters can be provided as a token68 string (for schemes like Bearer)
 * or as key-value pairs.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7235#section-4.1 | RFC 7235 Section 4.1}
 *
 * @example Bearer scheme with parameters
 * ```typescript
 * const auth: WWWAuthenticate = {
 *   Bearer: {
 *     realm: 'api.example.com',
 *     error: 'InvalidToken',
 *     error_description: 'The token has expired'
 *   }
 * }
 * // Formats to: Bearer realm="api.example.com", error="InvalidToken", error_description="The token has expired"
 * ```
 *
 * @example Multiple schemes
 * ```typescript
 * const auth: WWWAuthenticate = {
 *   Bearer: { realm: 'api' },
 *   Basic: { realm: 'api' }
 * }
 * // Formats to: Bearer realm="api", Basic realm="api"
 * ```
 *
 * @example Token68 value (no parameters)
 * ```typescript
 * const auth: WWWAuthenticate = {
 *   Bearer: 'base64encodedvalue=='
 * }
 * // Formats to: Bearer base64encodedvalue==
 * ```
 */
export type WWWAuthenticate = {
  [authScheme in string]?:
    | string // token68
    | WWWAuthenticateParams
    | (string | WWWAuthenticateParams)[]
}

export type WWWAuthenticateParams = { [authParam in string]?: string }

/**
 * Formats a WWWAuthenticate object into an HTTP header string.
 *
 * Converts the structured authentication scheme and parameter data into
 * the proper WWW-Authenticate header format per RFC 7235.
 *
 * @param wwwAuthenticate - The authentication schemes and parameters
 * @returns Formatted header string ready for use in HTTP responses
 *
 * @example
 * ```typescript
 * const header = formatWWWAuthenticateHeader({
 *   Bearer: {
 *     realm: 'api.example.com',
 *     error: 'MissingToken'
 *   }
 * })
 * // Returns: 'Bearer realm="api.example.com", error="MissingToken"'
 * ```
 *
 * @example Empty or undefined values
 * ```typescript
 * const header = formatWWWAuthenticateHeader({
 *   Bearer: { realm: 'api', error: undefined }
 * })
 * // Returns: 'Bearer realm="api"' (undefined values are omitted)
 * ```
 */
export function formatWWWAuthenticateHeader(
  wwwAuthenticate: WWWAuthenticate,
): string {
  const challenges: string[] = []
  for (const [scheme, params] of Object.entries(wwwAuthenticate)) {
    if (params == null) continue

    if (typeof params === 'string') {
      challenges.push(formatWWWAuthenticateChallenge(scheme, params))
    } else if (Array.isArray(params)) {
      for (const p of params) {
        challenges.push(formatWWWAuthenticateChallenge(scheme, p))
      }
    } else {
      challenges.push(formatWWWAuthenticateChallenge(scheme, params))
    }
  }
  return challenges.join(', ')
}

function formatWWWAuthenticateChallenge(
  scheme: string,
  params: string | WWWAuthenticateParams,
): string {
  const paramsStr =
    typeof params === 'string' ? params : formatWWWAuthenticateParams(params)
  return paramsStr?.length ? `${scheme} ${paramsStr}` : scheme
}

function formatWWWAuthenticateParams(params: WWWAuthenticateParams): string {
  const parts: string[] = []
  for (const [name, val] of Object.entries(params)) {
    if (val != null) parts.push(`${name}=${JSON.stringify(val)}`)
  }
  return parts.join(', ')
}

type WWWAuthenticateParams = { [authParam in string]: string }

/**
 * Parsed representation of a WWW-Authenticate HTTP header.
 *
 * Maps authentication scheme names to either:
 * - A token68 string (compact authentication data)
 * - A params object with key-value pairs
 *
 * @example Bearer with realm
 * ```typescript
 * // WWW-Authenticate: Bearer realm="example"
 * const parsed: WWWAuthenticate = {
 *   Bearer: { realm: 'example' }
 * }
 * ```
 *
 * @example DPoP with error
 * ```typescript
 * // WWW-Authenticate: DPoP error="use_dpop_nonce", error_description="..."
 * const parsed: WWWAuthenticate = {
 *   DPoP: { error: 'use_dpop_nonce', error_description: '...' }
 * }
 * ```
 */
export type WWWAuthenticate = {
  [authScheme in string]:
    | string // token68
    | WWWAuthenticateParams
}

/**
 * Returns `undefined` if the header is malformed.
 */
export function parseWWWAuthenticateHeader(
  header?: unknown,
): undefined | WWWAuthenticate {
  if (typeof header !== 'string') return undefined

  const wwwAuthenticate: WWWAuthenticate = {}

  // Split over commas, not within quoted strings
  const trimmedHeader = header.trim()
  if (!trimmedHeader) return wwwAuthenticate

  const parts = trimmedHeader.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)

  let currentParams: WWWAuthenticateParams | null = null

  for (let part of parts) {
    // Check if the part starts with an auth scheme
    const schemeMatch = part.trim().match(/^([^"=\s]+)(\s+.*)?$/)
    if (schemeMatch) {
      const scheme = schemeMatch[1]

      // Duplicate scheme
      if (Object.hasOwn(wwwAuthenticate, scheme)) return undefined

      const rest = schemeMatch[2]?.trim()
      if (!rest) {
        // Scheme only (no params or token68)
        currentParams = null
        wwwAuthenticate[scheme] = Object.create(null)
        continue
      }

      if (!rest.includes('=')) {
        // Scheme with token68
        currentParams = null
        wwwAuthenticate[scheme] = rest
        continue
      }

      // Scheme with params

      currentParams = Object.create(null) as WWWAuthenticateParams
      wwwAuthenticate[scheme] = currentParams

      // Fall through to parse params
      part = rest
    }

    // Invalid header
    if (!currentParams) return undefined

    const param = part.match(
      /^\s*([^"\s=]+)=(?:("[^"\\]*(?:\\.[^"\\]*)*")|([^\s,"]*))\s*$/,
    )

    // invalid param
    if (!param) return undefined

    const paramName = param[1]
    const paramValue =
      param[3] ?? param[2]!.slice(1, -1).replaceAll(/\\(.)/g, '$1')

    currentParams[paramName] = paramValue
  }

  return wwwAuthenticate
}

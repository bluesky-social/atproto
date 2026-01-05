export type WWWAuthenticate = {
  [authScheme in string]?:
    | string // token68
    | { [authParam in string]?: string }
}

export function formatWWWAuthenticateHeader(
  wwwAuthenticate: WWWAuthenticate,
): string {
  return Object.entries(wwwAuthenticate)
    .map(([authScheme, authParams]) => {
      if (authParams === undefined) return null
      const paramsEnc =
        typeof authParams === 'string'
          ? [authParams]
          : Object.entries(authParams)
              .filter(([_, val]) => val != null)
              .map(([name, val]) => `${name}=${JSON.stringify(val)}`)
      const authChallenge = paramsEnc?.length
        ? `${authScheme} ${paramsEnc.join(', ')}`
        : authScheme
      return authChallenge
    })
    .filter(Boolean)
    .join(', ')
}

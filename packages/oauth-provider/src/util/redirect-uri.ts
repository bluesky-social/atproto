/**
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8252#section-8.4}
 */
export function matchRedirectUri(
  allowed_uri: string,
  request_uri: string,
): boolean {
  // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
  //
  // > Authorization servers MUST require clients to register their complete
  // > redirect URI (including the path component) and reject authorization
  // > requests that specify a redirect URI that doesn't exactly match the
  // > one that was registered; the exception is loopback redirects, where
  // > an exact match is required except for the port URI component.
  if (allowed_uri === request_uri) return true

  // https://datatracker.ietf.org/doc/html/rfc8252#section-7.3
  const allowedUri = new URL(allowed_uri)
  if (
    allowedUri.hostname === 'localhost' ||
    allowedUri.hostname === '127.0.0.1' ||
    allowedUri.hostname === '[::1]'
  ) {
    const requestUri = new URL(request_uri)

    // > The authorization server MUST allow any port to be specified at the
    // > time of the request for loopback IP redirect URIs, to accommodate
    // > clients that obtain an available ephemeral port from the operating
    // > system at the time of the request.
    return (
      // allowedUri.port === requestUri.port &&
      allowedUri.hostname === requestUri.hostname &&
      allowedUri.pathname === requestUri.pathname &&
      allowedUri.protocol === requestUri.protocol &&
      allowedUri.search === requestUri.search &&
      allowedUri.hash === requestUri.hash &&
      allowedUri.username === requestUri.username &&
      allowedUri.password === requestUri.password
    )
  }

  return false
}

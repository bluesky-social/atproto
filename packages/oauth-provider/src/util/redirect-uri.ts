/**
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8252#section-8.4}
 */
export function matchRedirectUri(
  allowed_uri: string,
  request_uri: string,
): boolean {
  if (allowed_uri === request_uri) return true

  const allowed_uri_parsed = new URL(allowed_uri)

  // https://datatracker.ietf.org/doc/html/rfc8252#section-7.3
  if (
    allowed_uri_parsed.hostname !== 'localhost' &&
    allowed_uri_parsed.hostname !== '127.0.0.1' &&
    allowed_uri_parsed.hostname !== '[::1]'
  ) {
    return false
  }

  const request_uri_parsed = new URL(request_uri)

  // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
  //
  // > Authorization servers MUST require clients to register their complete
  // > redirect URI (including the path component) and reject authorization
  // > requests that specify a redirect URI that doesn't exactly match the
  // > one that was registered; the exception is loopback redirects, where
  // > an exact match is required except for the port URI component.
  return (
    // allowed_uri_parsed.port === request_uri_parsed.port &&
    allowed_uri_parsed.hostname === request_uri_parsed.hostname &&
    allowed_uri_parsed.pathname === request_uri_parsed.pathname &&
    allowed_uri_parsed.protocol === request_uri_parsed.protocol &&
    allowed_uri_parsed.search === request_uri_parsed.search &&
    allowed_uri_parsed.hash === request_uri_parsed.hash &&
    allowed_uri_parsed.username === request_uri_parsed.username &&
    allowed_uri_parsed.password === request_uri_parsed.password
  )
}

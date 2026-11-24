import type { DidString, Service } from './types.js'

export type XrpcRequestHeadersOptions = {
  /**
   * Additional custom HTTP headers to include in the request. A function is
   * called for every attempt (retries included), for headers that must differ
   * between attempts.
   *
   * @note "atproto-proxy" and "atproto-accept-labelers" headers might change
   * depending on the `service` and `labelers` options, respectively, if they
   * are provided (which is always the case when using {@link Client.xrpc}).
   */
  headers?:
    | HeadersInit
    | (() => undefined | HeadersInit | Promise<undefined | HeadersInit>)

  /**
   * Labeler DIDs to request labels from for content moderation.
   *
   * When `undefined`, will default to the client instance's default. When
   * `null`, it will cause any existing `atproto-accept-labelers` header
   * (including one provided through the
   * {@link XrpcRequestHeadersOptions.headers} option) to be removed.
   */
  labelers?: null | Iterable<DidString>

  /**
   * Labeler DIDs to request labels from for content moderation. Values here
   * will always be applied with the ";redact" suffix, which indicates that the
   * client is requesting that the labeler redact content that is deemed
   * inappropriate.
   */
  appLabelers?: null | Iterable<DidString>

  /**
   * Service proxy identifier for routing requests through a specific service.
   *
   * When `undefined`, will default to the client instance's default. When not
   * used against a client instance (e.g., when using the {@link xrpc} helper
   * function), the default is to not alter the `atproto-proxy` header (e.g. if
   * one is provided in the {@link XrpcRequestHeadersOptions.headers}).
   *
   * When defined (as either `null` or a string), it will override any
   * `atproto-proxy` header provided in the
   * {@link XrpcRequestHeadersOptions.headers} option.
   */
  service?: null | Service
}

/**
 * Builds HTTP headers for AT Protocol requests.
 *
 * Adds or removes the following headers based on the provided options:
 * - `atproto-proxy`: Service routing header (if service is specified)
 * - `atproto-accept-labelers`: Comma-separated list of labeler DIDs
 *
 * @see {@link XrpcRequestHeadersOptions}
 * @returns A new Headers object with AT Protocol headers added
 */
export async function buildXrpcRequestHeaders({
  service,
  labelers,
  appLabelers,
  headers: headersInit,
}: XrpcRequestHeadersOptions): Promise<Headers> {
  const headers = new Headers(
    typeof headersInit === 'function' ? await headersInit() : headersInit,
  )

  // If provided, the "service" option overrides any existing "atproto-proxy"
  // header. If `null`, the header is removed entirely.
  if (service !== undefined) {
    if (service === null) {
      headers.delete('atproto-proxy')
    } else {
      headers.set('atproto-proxy', service)
    }
  }

  // Labelers are combined from the "appLabelers" and "labelers" options, as
  // well as any existing "atproto-accept-labelers" header. The "appLabelers"
  // are always added with the ";redact" suffix, while the "labelers" are added
  // as-is. Existing labelers headers are not preserved if the "labelers" option
  // is explicitly set to null.
  const combinedLabelers = new Set<string>()

  if (appLabelers) {
    for (const labeler of appLabelers) {
      combinedLabelers.add(`${labeler};redact`)
    }
  }

  if (labelers) {
    for (const labeler of labelers) {
      combinedLabelers.add(labeler)
    }
  }

  if (labelers !== null) {
    const headersLabelers = headers.get('atproto-accept-labelers')
    if (headersLabelers) {
      for (const labeler of headersLabelers
        .split(',')
        .map(trim)
        .filter(Boolean)) {
        if (labeler) combinedLabelers.add(labeler)
      }
    }
  }

  if (combinedLabelers.size > 0) {
    headers.set(
      'atproto-accept-labelers',
      Array.from(combinedLabelers).join(', '),
    )
  } else {
    headers.delete('atproto-accept-labelers')
  }

  return headers
}

export function mergeHeaders(
  defaultHeaders: HeadersInit,
  requestHeaders?: HeadersInit,
): Headers {
  // We don't want to alter the original Headers objects, so we create a new one
  const result = new Headers(defaultHeaders)

  if (!requestHeaders) return result

  const overrides =
    requestHeaders instanceof Headers
      ? requestHeaders
      : new Headers(requestHeaders)

  for (const [key, value] of overrides.entries()) {
    result.set(key, value)
  }

  return result
}

function trim(value: string): string {
  return value.trim()
}

import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http'
import { context } from '@opentelemetry/api'
import { RPCType, getRPCMetadata } from '@opentelemetry/core'
import {
  HttpInstrumentation,
  type HttpInstrumentationConfig,
} from '@opentelemetry/instrumentation-http'
import {
  ATTR_HTTP_ROUTE,
  ATTR_XRPC_METHOD,
  ATTR_XRPC_PROXIED,
  ATTR_XRPC_PROXY,
} from '../conventions.js'

export type XrpcHttpInstrumentationConfig = HttpInstrumentationConfig & {
  /**
   * The XRPC methods (NSIDs) this service may serve, including any it proxies.
   *
   * Values provided here will be used to set the "http.route" attribute of
   * server metrics for XRPC requests. XRPC requests not listed here will have
   * their "http.route" attribute set to {@link UNKNOWN_XRPC_ROUTE}.
   *
   * When omitted, the metric route is left as set by the express
   * instrumentation (no XRPC-specific handling).
   *
   * @note This only affects metrics, whose attributes must stay low-cardinality
   * since any client can make up an NSID. Spans keep being named after the
   * requested NSID regardless.
   */
  xrpcMethods?: Iterable<string>
}

/**
 * The "http.route" reported on metrics for XRPC requests to a method that isn't
 * listed in {@link XrpcHttpInstrumentationConfig.xrpcMethods}. Braces
 * can't appear in an NSID, so this can't collide with a real method.
 */
export const UNKNOWN_XRPC_ROUTE = '/xrpc/{unknown}'

const XRPC_HTTP_METHODS = new Set(['GET', 'POST', 'OPTIONS', 'HEAD'])

/**
 * XRPC aware HTTP instrumentation for OpenTelemetry.
 *
 * @note This should be replaced with an instrumentation that patches the
 * `@atproto/xrpc-server` directly.
 */
export class XrpcHttpInstrumentation extends HttpInstrumentation {
  constructor({
    xrpcMethods,
    applyCustomAttributesOnSpan,
    responseHook,
    ...config
  }: XrpcHttpInstrumentationConfig = {}) {
    const lxmToRoute = xrpcMethods
      ? new Map<string, `/xrpc/${string}`>(
          // @NOTE Instead of using a Set, we pre-compute the route name so that
          // we don't need to compute them on every request later.
          Array.from(xrpcMethods, (input) => {
            // We first normalize the path to extract the local XRPC method (lxm)
            const lxm = extractUrlXrpcMethodName(`/xrpc/${input}`)
            if (lxm) return [lxm, `/xrpc/${lxm}`] as const
          }).filter((e) => e != null),
        )
      : undefined

    super({
      ...config,
      // Derives "http.route" (and the span name) from the normalized XRPC path,
      // for both incoming and outgoing requests.
      //
      // @NOTE Must be applyCustomAttributesOnSpan (fires on response finish),
      // not requestHook (fires on request start). The express instrumentation
      // overwrites the shared rpcMetadata.route on every layer it enters, which
      // in this app resolves to "/" more often than not (multiple express apps
      // and routers mounted at "/", plus catchall middlewares with no route
      // layer). On finish, the http instrumentation copies rpcMetadata.route
      // into "http.route" and renames the span from it, clobbering anything a
      // requestHook set. This hook runs after that, so it wins.
      applyCustomAttributesOnSpan: (span, request, response) => {
        const method = request.method
        if (method && XRPC_HTTP_METHODS.has(method)) {
          const client = isClientRequest(request)

          const url = client ? request.path : request.url
          const lxm = extractUrlXrpcMethodName(url)

          if (lxm) {
            // @NOTE low-cardinality does not matter here. We do want to normalize
            // the route for consistency across spans.
            const route = lxmToRoute?.get(lxm) ?? `/xrpc/${lxm}`
            const proxy = client
              ? request.getHeader('atproto-proxy')
              : request.headers['atproto-proxy']

            span.updateName(`${method} /xrpc/${lxm}`)
            span.setAttribute(ATTR_HTTP_ROUTE, route)
            span.setAttribute(ATTR_XRPC_METHOD, lxm)
            span.setAttribute(ATTR_XRPC_PROXIED, !!proxy)

            if (proxy) {
              span.setAttribute(ATTR_XRPC_PROXY, proxy)
            }
          }
        }

        return applyCustomAttributesOnSpan?.(span, request, response)
      },
      // Sets the (low-cardinality) XRPC route recorded on the server metric.
      //
      // @NOTE The metric's "http.route" isn't taken from the span: it's read
      // from the shared rpcMetadata.route when the response closes, before
      // applyCustomAttributesOnSpan above runs. The express instrumentation
      // overwrites rpcMetadata.route on every layer it enters, so the route
      // must be set on close rather than here. The http instrumentation adds
      // its own "close" listener right after calling this hook, so ours runs
      // first.
      // Opt-in: without a method list every XRPC request would be reported as
      // "unknown", which is worse than the route express recorded.
      responseHook: lxmToRoute
        ? (span, response) => {
            if (isServerResponse(response)) {
              const rpcMetadata = getRPCMetadata(context.active())
              if (rpcMetadata && rpcMetadata.type === RPCType.HTTP) {
                const { method, url } = response.req
                if (method && XRPC_HTTP_METHODS.has(method)) {
                  const lxm = extractUrlXrpcMethodName(url)
                  if (lxm) {
                    response.once('close', () => {
                      const route = lxmToRoute.get(lxm) ?? UNKNOWN_XRPC_ROUTE
                      rpcMetadata.route = route
                    })
                  }
                }
              }
            }

            return responseHook?.(span, response)
          }
        : responseHook,
    })
  }
}

// @NOTE Duck-typed rather than using instanceof, to avoid importing "node:http"
// from here (it must not be loaded before being instrumented).
function isServerResponse(response: object): response is ServerResponse {
  return 'req' in response && 'writeHead' in response
}

function isClientRequest(
  request: IncomingMessage | ClientRequest,
): request is ClientRequest {
  // @NOTE express gives incoming requests a "path" getter, which makes them
  // look like a ClientRequest. This check helps differentiate them.
  return 'path' in request && typeof request.getHeader === 'function'
}

const XRPC_PREFIX_LENGTH = 6 // "/xrpc/".length
const SHORTEST_CONCEIVABLE_NSID_LENGTH = 5 // "a.b.c"
const SHORTEST_CONCEIVABLE_XRPC_PATH_LENGTH =
  XRPC_PREFIX_LENGTH + SHORTEST_CONCEIVABLE_NSID_LENGTH

// @NOTE Hand-rolled (rather than using URL/split) because this runs on every
// instrumented request. Should become obsolete once we have dedicated
// XrpcClient/XrpcServer instrumentations.
export function extractUrlXrpcMethodName(url: unknown): string | undefined {
  if (typeof url !== 'string') {
    return undefined
  }

  if (
    // Ordered by likelihood of failure
    url.length < SHORTEST_CONCEIVABLE_XRPC_PATH_LENGTH ||
    url[5] !== '/' ||
    url[4] !== 'c' ||
    url[3] !== 'p' ||
    url[2] !== 'r' ||
    url[1] !== 'x' ||
    url[0] !== '/'
  ) {
    return undefined
  }

  const firstMethodCharPos = XRPC_PREFIX_LENGTH

  // Characters that can never open an NSID (note "_" skips "/xrpc/_health")
  const nextChar = url.charCodeAt(firstMethodCharPos)
  if (
    nextChar === 0x2e /* '.' */ ||
    nextChar === 0x2f /* '/' */ ||
    nextChar === 0x3f /* '?' */ ||
    nextChar === 0x5f /* '_' */
  ) {
    return undefined
  }

  const queryIndex = url.indexOf('?', firstMethodCharPos + 1) // nextChar was already searched for a "?" right above, so we can skip that char

  let lastMethodCharPos = queryIndex === -1 ? url.length - 1 : queryIndex - 1

  // Ignore the trailing slash, if there is one
  if (url.charCodeAt(lastMethodCharPos) === 0x2f /* '/' */) {
    lastMethodCharPos--
  }

  if (lastMethodCharPos + 1 < SHORTEST_CONCEIVABLE_XRPC_PATH_LENGTH) {
    return undefined
  }

  // Make sure there is no other slash in the path
  if (url.lastIndexOf('/', lastMethodCharPos) !== firstMethodCharPos - 1) {
    return undefined
  }

  // Require at least one dot, and not as the last character
  const lastDotPos = url.lastIndexOf('.', lastMethodCharPos)
  if (lastDotPos === -1 || lastDotPos === lastMethodCharPos) {
    return undefined
  }

  // @NOTE Only the domain authority is case-insensitive; the trailing name
  // segment is not, so it must be preserved as-is to avoid conflating
  // distinct NSIDs.
  return `${url.substring(firstMethodCharPos, lastDotPos).toLowerCase()}${url.substring(lastDotPos, lastMethodCharPos + 1)}`
}

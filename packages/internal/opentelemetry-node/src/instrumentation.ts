import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http'
import { context } from '@opentelemetry/api'
import { RPCType, getRPCMetadata } from '@opentelemetry/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import {
  ATTR_HTTP_ROUTE,
  ATTR_XRPC_METHOD,
  ATTR_XRPC_PROXIED,
  ATTR_XRPC_PROXY,
} from './conventions.js'
import { extractUrlXrpcMethodName } from './util.js'

/**
 * The "http.route" reported on metrics for XRPC requests to a method that isn't
 * listed in {@link DefaultAtprotoInstrumentationsOptions.xrpcMethods}. Braces
 * can't appear in an NSID, so this can't collide with a real method.
 */
export const UNKNOWN_XRPC_ROUTE = '/xrpc/{unknown}'

const XRPC_HTTP_METHODS = new Set(['GET', 'POST', 'OPTIONS', 'HEAD'])

export type DefaultAtprotoInstrumentationsOptions = {
  /**
   * The XRPC methods (NSIDs) this service may serve, including any it proxies.
   *
   * Values provided here will be used to set the "http.route" attribute for
   * XRPC requests. XRPC request not listed here will have their "http.route"
   * attribute set to {@link UNKNOWN_XRPC_ROUTE}.
   *
   * @note This only affects metrics, whose attributes must stay low-cardinality
   * since any client can make up an NSID. Spans keep being named after the
   * requested NSID regardless.
   */
  xrpcMethods?: Iterable<string>
}

/**
 * Default instrumentations for atproto Node.js services. Includes the runtime,
 * HTTP, Express, Undici, and Pino instrumentations, with XRPC-specific span
 * naming and attributes.
 */
export function getDefaultAtprotoInstrumentations(
  options?: DefaultAtprotoInstrumentationsOptions,
): Instrumentation[] {
  const lxmToRoute = options?.xrpcMethods
    ? new Map<string, `/xrpc/${string}`>(
        // @NOTE Instead of using a Set, we pre-compute the route name so that
        // we don't need to compute them on every request later.
        Array.from(options?.xrpcMethods, (input) => {
          // We first normalize the path to extract the local XRPC method (lxm)
          const lxm = extractUrlXrpcMethodName(`/xrpc/${input}`)
          if (lxm) return [lxm, `/xrpc/${lxm}`] as const
        }).filter((e) => e != null),
      )
    : undefined

  return [
    // @NOTE Not using getNodeAutoInstrumentations: it pulls in many
    // instrumentations we don't need, with no easy way to filter them out.
    new RuntimeNodeInstrumentation({ captureUncaughtException: true }),
    new HttpInstrumentation({
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
      applyCustomAttributesOnSpan: (span, request, _response) => {
        const method = request.method ?? 'GET'
        if (!XRPC_HTTP_METHODS.has(method)) return

        const client = isClientRequest(request)

        const url = client ? request.path : request.url
        if (!url || url === '/') return

        const lxm = extractUrlXrpcMethodName(url)
        if (!lxm) return

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
      responseHook: (_span, response) => {
        if (!isServerResponse(response)) return

        const rpcMetadata = getRPCMetadata(context.active())
        if (!rpcMetadata || rpcMetadata.type !== RPCType.HTTP) return

        const { method, url } = response.req
        if (!method || !XRPC_HTTP_METHODS.has(method)) return

        const lxm = extractUrlXrpcMethodName(url)
        if (!lxm) return // Not an XRPC request

        response.once('close', () => {
          const route = lxmToRoute?.get(lxm) ?? UNKNOWN_XRPC_ROUTE
          rpcMetadata.route = route
        })
      },
    }),
    new ExpressInstrumentation({
      ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
    }),
    new UndiciInstrumentation({
      requestHook: (span, request) => {
        const lxm = extractUrlXrpcMethodName(request.path)
        if (!lxm) return // Not an XRPC request

        span.setAttribute(ATTR_XRPC_METHOD, lxm)
      },
    }),
    // @NOTE Keep log correlation (trace_id/span_id injected into pino records)
    // but disable log sending: it JSON.parse()s every record on the main thread
    // and would forward all subsystems indiscriminately. Events we actually want
    // in the OTEL stack go through the Logs API explicitly (see each service's
    // events.ts).
    new PinoInstrumentation({ disableLogSending: true }),
  ]
}

// @NOTE Duck-typed rather than using instanceof, to avoid importing "node:http"
// from here (it must not be loaded before being instrumented).
function isServerResponse(response: object): response is ServerResponse {
  return 'req' in response && 'writeHead' in response
}

function isClientRequest(
  request: IncomingMessage | ClientRequest,
): request is ClientRequest {
  // @NOTE Tells incoming from outgoing requests by the response, since express
  // gives incoming requests a "path" getter, which makes them look like a
  // ClientRequest.
  return 'path' in request && typeof request.getHeader === 'function'
}

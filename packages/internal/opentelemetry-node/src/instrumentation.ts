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
import { extractNormalizedLxm } from './util.js'

/**
 * The "http.route" reported on metrics for XRPC requests to a method that isn't
 * listed in {@link AtprotoInstrumentationOptions.xrpcMethods}. Braces can't
 * appear in an NSID, so this can't collide with a real method.
 */
export const UNKNOWN_XRPC_ROUTE = '/xrpc/{unknown}'

export type AtprotoInstrumentationOptions = {
  /**
   * The XRPC methods (NSIDs) this service may serve, including any it proxies.
   *
   * When set, the "http.route" attribute of the `http.server.request.duration`
   * metric is "/xrpc/<nsid>" for these methods, and {@link UNKNOWN_XRPC_ROUTE}
   * for any other NSID. When unset, metrics get whatever route the express
   * instrumentation last saw, which for catchall handlers (proxying, etc.) is
   * usually "/" or nothing at all.
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
  options?: AtprotoInstrumentationOptions,
): Instrumentation[] {
  const getXrpcMetricRoute = buildXrpcMetricRouteGetter(options?.xrpcMethods)

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
      applyCustomAttributesOnSpan: (span, request, response) => {
        // @NOTE Tells incoming from outgoing requests by the response, since
        // express gives incoming requests a "path" getter, which makes them
        // look like a ClientRequest.
        const { url, method, proxy } = isServerResponse(response)
          ? // IncomingMessage
            {
              url: (request as IncomingMessage).url ?? '/',
              method: request.method ?? 'GET',
              proxy: (request as IncomingMessage).headers['atproto-proxy'],
            }
          : // ClientRequest
            {
              url: (request as ClientRequest).path,
              method: request.method,
              proxy: (request as ClientRequest).getHeader('atproto-proxy'),
            }

        const lxm =
          method === 'GET' || method === 'POST'
            ? extractNormalizedLxm(url)
            : undefined

        // Normalized route for XRPC, raw path otherwise
        const route = lxm ? `/xrpc/${lxm}` : url.split('?')[0]
        span.setAttribute(ATTR_HTTP_ROUTE, route)

        if (lxm) {
          span.updateName(`${method} /xrpc/${lxm}`)
          span.setAttribute(ATTR_XRPC_METHOD, lxm)
          span.setAttribute(ATTR_XRPC_PROXIED, !!proxy)

          if (proxy) {
            span.setAttribute(ATTR_XRPC_PROXY, proxy)
          }
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
      responseHook: getXrpcMetricRoute
        ? (_span, response) => {
            if (!isServerResponse(response)) return

            const { method, url } = response.req
            const lxm =
              method === 'GET' || method === 'POST'
                ? extractNormalizedLxm(url)
                : undefined
            if (!lxm) return

            const rpcMetadata = getRPCMetadata(context.active())
            if (rpcMetadata?.type !== RPCType.HTTP) return

            const route = getXrpcMetricRoute(lxm)
            response.once('close', () => {
              rpcMetadata.route = route
            })
          }
        : undefined,
    }),
    new ExpressInstrumentation({
      ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
    }),
    new UndiciInstrumentation({
      requestHook: (span, request) => {
        const lxm = extractNormalizedLxm(request.path)
        if (lxm) {
          span.setAttribute(ATTR_XRPC_METHOD, lxm)
        }
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

function buildXrpcMetricRouteGetter(
  xrpcMethods?: Iterable<string>,
): ((lxm: string) => string) | undefined {
  if (!xrpcMethods) return undefined

  // Normalized the same way as incoming requests, so that lookups match
  const knownLxms = new Set<string>()
  for (const nsid of xrpcMethods) {
    const lxm = extractNormalizedLxm(`/xrpc/${nsid}`)
    if (lxm) knownLxms.add(lxm)
  }

  return (lxm) => (knownLxms.has(lxm) ? `/xrpc/${lxm}` : UNKNOWN_XRPC_ROUTE)
}

// @NOTE Duck-typed rather than using instanceof, to avoid importing "node:http"
// from here (it must not be loaded before being instrumented).
function isServerResponse(response: object): response is ServerResponse {
  return 'req' in response && 'writeHead' in response
}

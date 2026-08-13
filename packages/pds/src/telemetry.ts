import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'
import { setup } from '@atproto/opentelemetry-node'
import {
  ATTR_HTTP_ROUTE,
  ATTR_XRPC_METHOD,
  ATTR_XRPC_PROXIED,
  ATTR_XRPC_PROXY,
} from '@atproto/opentelemetry-node/conventions'
import { extractNormalizedLxm } from '@atproto/opentelemetry-node/util'
import pkg from '@atproto/pds/package.json' with { type: 'json' }

setup({
  name: pkg.name,
  version: pkg.version,
  getInstrumentations: () => [
    // @NOTE Not using getNodeAutoInstrumentations: it pulls in many
    // instrumentations we don't need, with no easy way to filter them out.
    new RuntimeNodeInstrumentation(),
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
      applyCustomAttributesOnSpan: (span, request) => {
        const { url, method, proxy } =
          'path' in request
            ? // ClientRequest
              {
                url: request.path,
                method: request.method,
                proxy: request.getHeader('atproto-proxy'),
              }
            : // IncomingMessage
              {
                url: request.url ?? '/',
                method: request.method ?? 'GET',
                proxy: request.headers['atproto-proxy'],
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
    new AwsInstrumentation(),
    new IORedisInstrumentation(),
    new BetterSqlite3Instrumentation(),
    // @NOTE Keep log correlation (trace_id/span_id injected into pino records)
    // but disable log sending: it JSON.parse()s every record on the main thread
    // and would forward all subsystems indiscriminately. Events we actually want
    // in the OTEL stack go through the Logs API explicitly (see ./events.ts).
    new PinoInstrumentation({ disableLogSending: true }),
  ],
})

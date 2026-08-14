import { register } from 'node:module'
import { diag } from '@opentelemetry/api'
import { getResourceDetectors } from '@opentelemetry/auto-instrumentations-node'
import {
  getBooleanFromEnv,
  getStringFromEnv,
  getStringListFromEnv,
} from '@opentelemetry/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
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
import { NodeSDK, resources } from '@opentelemetry/sdk-node'
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_HTTP_ROUTE,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'
import pkg from '@atproto/pds/package.json' with { type: 'json' }

const ATTR_XRPC_METHOD = 'xrpc.method'
const ATTR_XRPC_PROXIED = 'xrpc.proxied'
const ATTR_XRPC_PROXY = 'xrpc.proxy'

// @NOTE Hand-rolled equivalent of "@opentelemetry/auto-instrumentations-node"'s
// register script, because that one lacks better-sqlite3 instrumentation and
// doesn't let us customize the HTTP span naming for XRPC. We use `NodeSDK`
// rather than `@opentelemetry/instrumentation`'s `registerInstrumentations` to
// get exporter setup from the conventional OTEL_* env vars for free.

// @NOTE Telemetry is opt-in via exporter endpoint rather than a non-standard
// flag: configuring an OTLP endpoint is what enables the SDK. OTEL_SDK_DISABLED
// remains a kill switch, per spec.
const otelDisabled = getBooleanFromEnv('OTEL_SDK_DISABLED')
const tracesConfigured = isSignalConfigured('TRACES')
const metricsConfigured = isSignalConfigured('METRICS')
const logsConfigured = isSignalConfigured('LOGS')
const otelConfigured = tracesConfigured || metricsConfigured || logsConfigured
const otelEnabled = !otelDisabled && otelConfigured

if (otelEnabled) {
  try {
    register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

    const sdk = new NodeSDK({
      // @NOTE Passing "resource" replaces (rather than augments) NodeSDK's
      // defaultResource(), so merge our defaults on top of it. Detected
      // resources (including the env detector reading OTEL_RESOURCE_ATTRIBUTES)
      // are merged in afterwards with higher precedence, so these are defaults
      // only.
      resource: resources.defaultResource().merge(
        resources.resourceFromAttributes({
          [ATTR_SERVICE_NAME]: pkg.name,
          [ATTR_SERVICE_NAMESPACE]: 'atproto',
          [ATTR_SERVICE_VERSION]: pkg.version,
          [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
            process.env.NODE_ENV || 'production',
        }),
      ),
      // @NOTE Unlike sdk-node's default detectors, these include the
      // "container" detector.
      resourceDetectors: getResourceDetectors(),
      instrumentations: getInstrumentations(),

      // @NOTE The gate above enables the SDK as soon as *any* signal is
      // configured, but NodeSDK then defaults every unspecified
      // OTEL_{SIGNAL}_EXPORTER to "otlp" on http://localhost:4318 — shipping
      // signals the operator never opted into. An *empty* pipeline opts a
      // signal out: NodeSDK only reads OTEL_{SIGNAL}_EXPORTER when the pipeline
      // option is `undefined`, and registers no provider when handed an empty
      // one. Opted-in signals get `undefined` so they stay env-configured.
      spanProcessors: tracesConfigured ? undefined : [],
      metricReaders: metricsConfigured ? undefined : [],
      logRecordProcessors: logsConfigured ? undefined : [],
    })

    sdk.start()

    // @NOTE On SIGINT/SIGTERM the PDS releases its resources without calling
    // process.exit(), so the event loop empties and Node emits "beforeExit"
    // (https://nodejs.org/api/process.html#event-beforeexit). That's our window
    // to flush pending telemetry.
    process.once('beforeExit', () => {
      sdk.shutdown().catch((err) => {
        diag.error('Error terminating OpenTelemetry SDK', err)
      })
    })
  } catch (err) {
    diag.error('Error initializing OpenTelemetry SDK', err)
  }
}

function getInstrumentations(): Instrumentation[] {
  return [
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
  ]
}

/**
 * A signal counts as configured when an OTLP endpoint applies to it
 * (signal-specific or generic) and its exporter isn't set to "none".
 *
 * @NOTE OTEL_{SIGNAL}_EXPORTER is a comma-separated list, and the SDK handles
 * "none" alongside other exporters inconsistently (metrics & logs disable the
 * signal, traces falls back to "otlp"). Such a combination is a
 * misconfiguration, so we treat any list containing "none" as disabling.
 */
function isSignalConfigured(signal: 'TRACES' | 'METRICS' | 'LOGS'): boolean {
  if (getStringListFromEnv(`OTEL_${signal}_EXPORTER`)?.includes('none')) {
    return false
  }

  return (
    !!getStringFromEnv(`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`) ||
    !!getStringFromEnv('OTEL_EXPORTER_OTLP_ENDPOINT')
  )
}

// @NOTE Hand-rolled (rather than using URL/split) because this runs on every
// instrumented request. Should become obsolete once we have dedicated
// XrpcClient/XrpcServer instrumentations.
function extractNormalizedLxm(url: unknown): string | undefined {
  if (typeof url !== 'string') {
    return undefined
  }

  // 9 = "/xrpc/".length + shortest conceivable NSID ("a.b")
  if (url.length < 9 || !url.startsWith('/xrpc/')) {
    return undefined
  }

  const firstMethodCharPos = 6 // "/xrpc/".length

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

  const queryIndex = url.indexOf('?', firstMethodCharPos + 1)

  let lastMethodCharPos = queryIndex === -1 ? url.length - 1 : queryIndex - 1

  // Ignore the trailing slash, if there is one
  if (url.charCodeAt(lastMethodCharPos) === 0x2f /* '/' */) {
    lastMethodCharPos--
  }

  if (lastMethodCharPos < 9) {
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

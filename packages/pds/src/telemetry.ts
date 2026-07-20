/* eslint-env node */

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
import { NodeSDK, type NodeSDKConfiguration } from '@opentelemetry/sdk-node'
import { ATTR_HTTP_ROUTE } from '@opentelemetry/semantic-conventions'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'

const ATTR_XRPC_METHOD = 'xrpc.method'

// @NOTE This is similar to "@opentelemetry/auto-instrumentations-node"'s
// register script. We provide our own telemetry script because:
//
// 1) auto-instrumentations-node does not provide instrumentation for
//    better-sqlite3.
// 2) we want to customize the HttpInstrumentation to provide better span name
//    and attributes for XRPC requests.
// ) this approach also registers the instrumentation hook
//
// We also use `startNodeSDK` instead of `registerInstrumentations` because it
// will setup metric and traces exporters automatically based on conventional
// OpenTelemetry environment variables.

// @NOTE The SDK is only enabled when telemetry is explicitly configured
// (through an OTLP exporter endpoint). This makes telemetry opt-in without
// inventing a non-standard flag: setting an exporter endpoint is what opts you
// in. OTEL_SDK_DISABLED=true still acts as a kill switch, per the OpenTelemetry
// spec.
const otelDisabled = getBooleanFromEnv('OTEL_SDK_DISABLED')
const otelConfigured =
  isSignalConfigured('TRACES') ||
  isSignalConfigured('METRICS') ||
  isSignalConfigured('LOGS')
const otelEnabled = !otelDisabled && otelConfigured

if (otelEnabled) {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

  const { shutdown } = startNodeSDKClass({
    // @NOTE We use getResourceDetectors from
    // @opentelemetry/auto-instrumentations-node (instead of the default from
    // @opentelemetry/sdk-node) because it supports the "container" resource
    // detector, which is not included in the default NodeSDK resource
    // detectors.
    resourceDetectors: getResourceDetectors(),
    instrumentations: getInstrumentations(),
  })

  // @NOTE The PDS will destroy all the resources it owns when it shuts down
  // (SIGINT/SIGTERM), and does not explicitly call process.exit(). This will
  // cause NodeJS to trigger the "beforeExit" event (see
  // https://nodejs.org/api/process.html#event-beforeexit), allowing us to
  // shutdown the OpenTelemetry SDK and flush any telemetry before the process
  // exits because of the event loop being empty.
  process.once('beforeExit', shutdown)
}

function getInstrumentations(): Instrumentation[] {
  return [
    // @NOTE We *DON'T* use getNodeAutoInstrumentations from
    // @opentelemetry/auto-instrumentations-node because it loads a lot of
    // un-necessary instrumentations with no easy way to filter them out.
    new RuntimeNodeInstrumentation(),
    new HttpInstrumentation({
      // Sets the "http.route" attribute for XRPC requests (both incoming and
      // outgoing) based on the normalized XRPC path.
      //
      // @NOTE We use applyCustomAttributesOnSpan (which fires when the
      // response finishes) rather than requestHook (which fires when the
      // request starts) because of how the express instrumentation interacts
      // with the http instrumentation: on every express layer it enters, the
      // express instrumentation overwrites the shared rpcMetadata.route with
      // the route it computed from express's layer stack. Since this app
      // composes multiple express apps and routers mounted at "/" (and some
      // requests are handled by catchall middlewares with no route layer at
      // all), that computed route is often just "/". When the response
      // finishes, the http instrumentation copies rpcMetadata.route into the
      // "http.route" attribute — clobbering anything a requestHook set — and
      // renames the incoming span to "${method} ${route}" from it.
      // applyCustomAttributesOnSpan runs *after* that copy-and-rename, so the
      // attributes and span name we set here are authoritative.
      applyCustomAttributesOnSpan: (span, request) => {
        const url = 'path' in request ? request.path : request.url ?? '/'
        const method = request.method ?? 'GET'
        const nsid =
          method === 'GET' || method === 'POST'
            ? extractNormalizedXrpcNsid(url)
            : undefined

        // Use a normalized route for XRPC requests, and the raw path for
        // non-XRPC requests
        const route = nsid ? `/xrpc/${nsid}` : url.split('?')[0]
        span.setAttribute(ATTR_HTTP_ROUTE, route)

        // set the xrpc.method attribute for both incoming and outgoing requests
        if (nsid) {
          span.updateName(`${method} /xrpc/${nsid}`)
          span.setAttribute(ATTR_XRPC_METHOD, nsid)
        }
      },
    }),
    new ExpressInstrumentation({
      ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
    }),
    new UndiciInstrumentation({
      requestHook: (span, request) => {
        const nsid = extractNormalizedXrpcNsid(request.path)
        if (nsid) {
          span.setAttribute(ATTR_XRPC_METHOD, nsid)
        }
      },
    }),
    new AwsInstrumentation(),
    new IORedisInstrumentation(),
    new BetterSqlite3Instrumentation(),
    new PinoInstrumentation(),
  ]
}

/**
 * Determines whether a telemetry signal (traces, metrics or logs) is
 * explicitly configured for export, based on the conventional OpenTelemetry
 * environment variables. A signal is considered configured when an OTLP
 * endpoint applies to it (signal-specific or generic), unless its exporter
 * was explicitly set to "none" (e.g. OTEL_TRACES_EXPORTER=none).
 *
 * @NOTE The OTEL_{SIGNAL}_EXPORTER variables are comma-separated lists. The
 * SDK's per-signal handling of "none" combined with other exporters varies
 * (metrics & logs disable the signal, traces falls back to "otlp" with a
 * warning), but since such a combination is a misconfiguration anyway, we
 * simply treat any list containing "none" as disabling the signal.
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

/**
 * Wrapper that exposes an api similar to {@link startNodeSDK}, but uses the
 * {@link NodeSDK} class instead.
 *
 * {@link NodeSDK} and {@link startNodeSDK} have similar, though slightly
 * different behaviors. For example, {@link NodeSDK} does not support loading
 * configuration from a file (OTEL_CONFIG_FILE), while {@link startNodeSDK} does
 * not support creating an HTTP prometheus exporter.
 */
function startNodeSDKClass(configuration?: Partial<NodeSDKConfiguration>): {
  shutdown: () => Promise<void>
} {
  try {
    const sdk = new NodeSDK(configuration)

    sdk.start()

    const shutdown = async () => {
      try {
        await sdk.shutdown()
      } catch (err) {
        diag.error('Error terminating OpenTelemetry SDK', err)
      }
    }

    return { shutdown }
  } catch (err) {
    diag.error(
      'Error initializing OpenTelemetry SDK. Your application is not instrumented and will not produce telemetry',
      err,
    )

    // Mock handler
    return { shutdown: async () => {} }
  }
}

// @NOTE This should become obsolete once we have dedicated
// XrpcClient/XrpcServer instrumentations.
function extractNormalizedXrpcNsid(url: unknown): string | undefined {
  if (typeof url !== 'string') {
    return undefined
  }

  if (url.length < 9 || !url.startsWith('/xrpc/')) {
    return undefined
  }

  const firstMethodCharPos = 6 // "/xrpc/".length

  // Quick sanity check
  const nextChar = url.charCodeAt(firstMethodCharPos)
  if (
    nextChar === 0x2e /* '.' */ ||
    nextChar === 0x2f /* '/' */ ||
    nextChar === 0x3f /* '?' */ ||
    nextChar === 0x5f /* '_' (matches "/xrpc/_health") */
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

  // Make sure there is at least one dot in the method name, and that it is not
  // the last character of the method name.
  const lastDotPos = url.lastIndexOf('.', lastMethodCharPos)
  if (lastDotPos === -1 || lastDotPos === lastMethodCharPos) {
    return undefined
  }

  return `${url.substring(firstMethodCharPos, lastDotPos).toLowerCase()}${url.substring(lastDotPos, lastMethodCharPos + 1)}`
}

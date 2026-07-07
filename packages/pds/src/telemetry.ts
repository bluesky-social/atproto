/* eslint-env node */

import { register } from 'node:module'
import { diag } from '@opentelemetry/api'
import { getResourceDetectors } from '@opentelemetry/auto-instrumentations-node'
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import {
  NodeSDK,
  type NodeSDKConfiguration,
  startNodeSDK,
} from '@opentelemetry/sdk-node'
import { ATTR_HTTP_ROUTE } from '@opentelemetry/semantic-conventions'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'

// @NOTE This is similar to "@opentelemetry/auto-instrumentations-node"'s
// register script. We provide our own telemetry script because:
//
// 1) auto-instrumentations-node does not provide instrumentation for
//    better-sqlite3.
// 2) we want to customize the HttpInstrumentation to provide better span name
//    and attributes for XRPC requests.
// 3) auto-instrumentations-node does not support configuring instrumentations
//    via a configuration file (OTEL_CONFIG_FILE).
//
// Replacing this script with auto-instrumentations-node would also require to
// explicitly set the OTEL_NODE_ENABLED_INSTRUMENTATIONS environment variable to
// avoid loading unnecessary instrumentations.
//
// We also use `startNodeSDK` instead of `registerInstrumentations` because it
// will setup metric and traces exporters automatically based on conventional
// OpenTelemetry environment variables.
//
// If there is an OTEL_CONFIG_FILE environment variable, the SDK will load the
// configuration from that file. Otherwise, the SDK will load the configuration
// from environment variables.

// @NOTE @opentelemetry/sdk-node provides two ways to start the SDK:
// startNodeSDK and new NodeSDK. We determine which one to use based on the
// presence of the OTEL_CONFIG_FILE environment variable. If it is set, we use
// startNodeSDK, which will load the configuration from a YAML file.
// Otherwise, we use new NodeSDK, which will load the configuration from
// environment variables (and supports creating an HTTP prometheus exporter).
// @NOTE The SDK is only enabled when telemetry is explicitly configured
// (through OTEL_CONFIG_FILE or an OTLP exporter endpoint). This makes
// telemetry opt-in without inventing a non-standard flag: setting an exporter
// endpoint is what opts you in. OTEL_SDK_DISABLED=true still acts as a kill
// switch, per the OpenTelemetry spec.
const disabled = process.env.OTEL_SDK_DISABLED?.toLowerCase() === 'true'
const configured =
  !!process.env.OTEL_CONFIG_FILE ||
  isSignalConfigured('TRACES') ||
  isSignalConfigured('METRICS') ||
  isSignalConfigured('LOGS')

const enabled = !disabled && configured
if (enabled) {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

  const start = process.env.OTEL_CONFIG_FILE ? startNodeSDK : startNodeSDKClass
  const { shutdown } = start({
    // @NOTE We use getResourceDetectors from
    // @opentelemetry/auto-instrumentations-node (instead of the default from
    // @opentelemetry/sdk-node) because it supports the "container" resource
    // detector, which is not included in the default NodeSDK resource
    // detectors.
    resourceDetectors: getResourceDetectors(),
    instrumentations: [
      // @NOTE We *DON'T* use getNodeAutoInstrumentations from
      // @opentelemetry/auto-instrumentations-node because it loads a lot of
      // un-necessary instrumentations with no easy way to filter them out.
      new RuntimeNodeInstrumentation(),
      new HttpInstrumentation({
        // Sets the "http.route" attribute for XRPC requests (both incoming and
        // outgoing) based on the normalized XRPC path.
        //
        // @TODO replace with dedicated XrpcClient/XrpcServer instrumentations
        requestHook: (span, request) => {
          const url = 'path' in request ? request.path : request.url
          if (url != null) {
            const endpoint = extractNormalizedXrpcEndpoint(url)
            // @NOTE The ATTR_HTTP_ROUTE attribute is used internally by
            // HttpInstrumentation to update the incoming server request span
            // name to: "${method ?? 'GET'} ${route}".
            if (endpoint) span.setAttribute(ATTR_HTTP_ROUTE, endpoint)
          }
        },
      }),
      new ExpressInstrumentation(),
      new UndiciInstrumentation({
        requestHook: (span, request) => {
          const endpoint = extractNormalizedXrpcEndpoint(request.path)
          if (endpoint) span.setAttribute(ATTR_HTTP_ROUTE, endpoint)
        },
      }),
      new AwsInstrumentation(),
      new IORedisInstrumentation(),
      new BetterSqlite3Instrumentation(),
      new PinoInstrumentation(),
    ],
  })

  const onExit = () => {
    process.removeListener('SIGTERM', onExit)
    process.removeListener('SIGINT', onExit)
    process.removeListener('beforeExit', onExit)
    void shutdown().catch((err) => {
      diag.error('Error terminating OpenTelemetry SDK', err)
    })
  }

  process.addListener('SIGTERM', onExit)
  process.addListener('SIGINT', onExit)
  process.addListener('beforeExit', onExit)
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
  // Matches "none" as an item of the comma-separated list (mimicking
  // @opentelemetry/core's getStringListFromEnv parsing)
  const exporters = process.env[`OTEL_${signal}_EXPORTER`]
  if (exporters != null && /(^|,)\s*none\s*(,|$)/i.test(exporters)) {
    return false
  }

  return (
    !!process.env[`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`] ||
    !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT
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
function extractNormalizedXrpcEndpoint(url: string): string | undefined {
  // ⚠️ HOT PATH ⚠️

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

  return `${url.substring(0, lastDotPos).toLowerCase()}${url.substring(lastDotPos, lastMethodCharPos + 1)}`
}

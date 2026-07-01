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
// 0) auto-instrumentations-node does not allow to easily disable the
//    node:module hook when the SDK is disabled.
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

const onExit = async () => {
  process.off('SIGTERM', onExit)
  process.off('SIGINT', onExit)
  process.off('beforeExit', onExit)
  await shutdown()
}

process.on('SIGTERM', onExit)
process.on('SIGINT', onExit)
process.on('beforeExit', onExit)

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

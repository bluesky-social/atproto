/* eslint-env node */

import { diag } from '@opentelemetry/api'
import { getResourceDetectors } from '@opentelemetry/auto-instrumentations-node'
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { register } from 'node:module'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'

// @NOTE This is inspired (and is similar to) the
// @opentelemetry/auto-instrumentations-node/register script. We don't use that
// script directly because:
//
// 1) it does not provide instrumentation for better-sqlite3
// 2) we want to customize the HttpInstrumentation to provide better span names
//    for XRPC requests.
//
// Enabling it would also require to explicitly set the
// OTEL_NODE_ENABLED_INSTRUMENTATIONS environment variable to avoid loading
// unnecessary instrumentations.

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Required for instrumentation of ESM Modules in Node.js.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

  const sdk = new NodeSDK({
    serviceName: 'atproto-pds',
    // @NOTE We use getResourceDetectors from
    // @opentelemetry/auto-instrumentations-node because it supports the
    // container resource detector, which is not included in the default NodeSDK
    // resource detectors.
    resourceDetectors: getResourceDetectors(),
    instrumentations: [
      // @NOTE We *DON'T* use getNodeAutoInstrumentations from
      // @opentelemetry/auto-instrumentations-node because it loads a lot
      // of instrumentations that we don't need without an easy way to manually
      // filter them out.
      new RuntimeNodeInstrumentation(),
      new HttpInstrumentation({
        applyCustomAttributesOnSpan(span, request) {
          if ('url' in request && request.url?.startsWith('/xrpc/')) {
            const queryIndex = request.url.indexOf('?', 6)
            if (
              request.url.lastIndexOf(
                '/',
                queryIndex === -1 ? undefined : queryIndex,
              ) === 5
            ) {
              const nsid = request.url.slice(
                6,
                queryIndex === -1 ? undefined : queryIndex,
              )
              span.updateName(`XRPC ${nsid}`)
            }
          }
        },
      }),
      new ExpressInstrumentation(),
      new UndiciInstrumentation(),
      new AwsInstrumentation(),
      new IORedisInstrumentation(),
      new BetterSqlite3Instrumentation(),
      new PinoInstrumentation(),
    ],
  })

  try {
    sdk.start()
    diag.info('OpenTelemetry automatic instrumentation started successfully')
  } catch (error) {
    diag.error(
      'Error initializing OpenTelemetry SDK. Your application is not instrumented and will not produce telemetry',
      error,
    )
  }

  async function shutdown() {
    try {
      await sdk.shutdown()
      diag.debug('OpenTelemetry SDK terminated')
    } catch (error) {
      diag.error('Error terminating OpenTelemetry SDK', error)
    }
  }

  sdk.start()

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  process.once('beforeExit', shutdown)
}

import { register } from 'node:module'
import { type Attributes, diag } from '@opentelemetry/api'
import { getResourceDetectors } from '@opentelemetry/auto-instrumentations-node'
import {
  getBooleanFromEnv,
  getStringFromEnv,
  getStringListFromEnv,
} from '@opentelemetry/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { NodeSDK, resources } from '@opentelemetry/sdk-node'
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
} from './conventions.js'
import { getDefaultAtprotoInstrumentations } from './instrumentation.js'

export type { Attributes, Instrumentation }

export type SetupOptions = {
  name: string
  version: string
  /**
   * Extra resource attributes merged on top of the internal defaults (service
   * name/version/namespace and deployment environment). Detected resources
   * (including the env detector reading `OTEL_RESOURCE_ATTRIBUTES`) still take
   * precedence, so these remain defaults.
   */
  defaultResourceAttributes?: Attributes
  instrumentations?: Instrumentation[]
}

// @NOTE Hand-rolled equivalent of "@opentelemetry/auto-instrumentations-node"'s
// register script, because that one lacks better-sqlite3 instrumentation and
// doesn't let us customize the HTTP span naming for XRPC. We use `NodeSDK`
// rather than `@opentelemetry/instrumentation`'s `registerInstrumentations` to
// get exporter setup from the conventional OTEL_* env vars for free.

/**
 * Bootstraps the OpenTelemetry Node SDK from the conventional `OTEL_*`
 * environment variables. A no-op unless an OTLP endpoint is configured.
 *
 * @note Telemetry is opt-in via exporter endpoint rather than a non-standard
 * flag: configuring an OTLP endpoint is what enables the SDK.
 * `OTEL_SDK_DISABLED` remains a kill switch, per spec.
 */
export function setup(getOptions: () => SetupOptions): void {
  const otelDisabled = getBooleanFromEnv('OTEL_SDK_DISABLED')
  const tracesConfigured = isSignalConfigured('TRACES')
  const metricsConfigured = isSignalConfigured('METRICS')
  const logsConfigured = isSignalConfigured('LOGS')
  const otelConfigured = tracesConfigured || metricsConfigured || logsConfigured
  const otelEnabled = !otelDisabled && otelConfigured

  if (!otelEnabled) return

  try {
    const options = getOptions()

    register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

    const sdk = new NodeSDK({
      // @NOTE Passing "resource" replaces (rather than augments) NodeSDK's
      // defaultResource(), so merge our defaults on top of it. Detected
      // resources (including the env detector reading OTEL_RESOURCE_ATTRIBUTES)
      // are merged in afterwards with higher precedence, so these are defaults
      // only.
      resource: resources.defaultResource().merge(
        resources.resourceFromAttributes({
          [ATTR_SERVICE_NAME]: options.name,
          [ATTR_SERVICE_NAMESPACE]: 'atproto',
          [ATTR_SERVICE_VERSION]: options.version,
          [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
            process.env.NODE_ENV || 'production',
          ...options.defaultResourceAttributes,
        }),
      ),
      // @NOTE Unlike sdk-node's default detectors, these include the
      // "container" detector.
      resourceDetectors: getResourceDetectors(),
      instrumentations: [
        ...getDefaultAtprotoInstrumentations(),
        ...(options.instrumentations ?? []),
      ],

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

    // @NOTE On SIGINT/SIGTERM the service releases its resources without calling
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

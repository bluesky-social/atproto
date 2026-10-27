import {
  type Instrumentation,
  InstrumentationBase,
} from '@opentelemetry/instrumentation'
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from '@opentelemetry/instrumentation-express'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { ATTR_XRPC_METHOD } from './conventions.js'
import {
  XrpcHttpInstrumentation,
  type XrpcHttpInstrumentationConfig,
  extractUrlXrpcMethodName,
} from './instrumentations/xrpc-http-instrumentation.js'

export type BuildInstrumentationsOptions =
  DefaultAtprotoInstrumentationsOptions & {
    instrumentations?: Instrumentation[]
  }

export function buildInstrumentations(options: BuildInstrumentationsOptions) {
  const instrumentations = [
    ...getDefaultAtprotoInstrumentations(options),
    ...(options.instrumentations ?? []),
  ]
  assertSharedInstrumentationBase(instrumentations)
  return instrumentations
}

export class InstrumentationMismatchError extends Error {
  name = 'InstrumentationMismatchError'
}

/**
 * import-in-the-middle only hooks the ESM imports of modules targeted by
 * instrumentations built on the same `@opentelemetry/instrumentation` copy as
 * this package (see {@link setup}). Instrumentations built on another copy
 * would silently miss them.
 */
function assertSharedInstrumentationBase(instrumentations: Instrumentation[]) {
  const foreign = instrumentations.filter(
    (i) => !(i instanceof InstrumentationBase) && 'getModuleDefinitions' in i,
  )
  if (foreign.length) {
    const names = foreign.map((i) => `"${i.instrumentationName}"`).join(', ')
    throw new InstrumentationMismatchError(
      `Instrumentation(s) ${names} use a different copy of @opentelemetry/instrumentation than @atproto-labs/opentelemetry-node, so ESM imports of the modules they target would not be instrumented. Make them resolve the same @opentelemetry/instrumentation (e.g. with a package manager override), or use instrumentations built on it.`,
    )
  }
}

export type DefaultAtprotoInstrumentationsOptions =
  XrpcHttpInstrumentationConfig

/**
 * Default instrumentations for atproto Node.js services. Includes the runtime,
 * HTTP, Express, Undici, and Pino instrumentations, with XRPC-specific span
 * naming and attributes.
 */
export function getDefaultAtprotoInstrumentations(
  options?: DefaultAtprotoInstrumentationsOptions,
): Instrumentation[] {
  return [
    // @NOTE Not using getNodeAutoInstrumentations: it pulls in many
    // instrumentations we don't need, with no easy way to filter them out.
    new RuntimeNodeInstrumentation({ captureUncaughtException: true }),
    new XrpcHttpInstrumentation(options),
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

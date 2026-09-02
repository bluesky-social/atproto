import { performance } from 'node:perf_hooks'
import {
  Code,
  ConnectError,
  type Interceptor,
  type StreamRequest,
  type UnaryRequest,
} from '@connectrpc/connect'
import {
  type Attributes,
  SpanKind,
  SpanStatusCode,
  type TextMapSetter,
  ValueType,
  context,
  metrics,
  propagation,
  trace,
} from '@opentelemetry/api'
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions'
import {
  ATTR_RPC_METHOD,
  ATTR_RPC_RESPONSE_STATUS_CODE,
  ATTR_RPC_SYSTEM_NAME,
  METRIC_RPC_CLIENT_CALL_DURATION,
  RPC_SYSTEM_NAME_VALUE_CONNECTRPC,
} from '@opentelemetry/semantic-conventions/incubating'
import { RPC_CALL_DURATION_BUCKETS } from '@atproto-labs/opentelemetry-node/conventions'
import { statusCodeToString } from '@atproto-labs/opentelemetry-node/util'

type RpcRequest = UnaryRequest | StreamRequest

/**
 * Derives extra attributes from a request. The returned attributes land on both
 * the duration histogram and the client span, so they must stay
 * low-cardinality: no DIDs, keys or URIs, which would explode the metric series.
 */
type GetAttributes = (request: RpcRequest) => Attributes

const tracer = trace.getTracer('@atproto/bsky')
const meter = metrics.getMeter('@atproto/bsky')
const rpcClientDuration = meter.createHistogram(
  METRIC_RPC_CLIENT_CALL_DURATION,
  {
    description: 'Measures the duration of an outgoing Remote Procedure Call',
    unit: 's',
    valueType: ValueType.DOUBLE,
    advice: { explicitBucketBoundaries: RPC_CALL_DURATION_BUCKETS },
  },
)

const headersSetter: TextMapSetter<Headers> = {
  set(carrier, key, value) {
    carrier.set(key, value)
  },
}

/**
 * Records client-side telemetry for every outbound Connect RPC: an
 * `rpc.client.call.duration` histogram and a CLIENT span, with the trace
 * context injected into the request headers so the callee's spans join this
 * trace.
 *
 * The server half of a bsync call is recorded by `@atproto/bsync`'s
 * `withRpcServerTelemetry`, using the same attribute keys.
 */
export const createRpcClientInterceptor = (
  getAttributes?: GetAttributes,
): Interceptor => {
  return (next) => async (req) => {
    // @NOTE The RPC convention requires `rpc.method` to be the fully-qualified
    // method name, so the service name is part of it rather than an attribute
    // of its own.
    const method = `${req.service.typeName}/${req.method.name}`
    const attributes: Attributes = {
      [ATTR_RPC_SYSTEM_NAME]: RPC_SYSTEM_NAME_VALUE_CONNECTRPC,
      [ATTR_RPC_METHOD]: method,
      ...getAttributes?.(req),
    }
    const start = performance.now()

    return tracer.startActiveSpan(
      method,
      { kind: SpanKind.CLIENT, attributes },
      async (span) => {
        propagation.inject(context.active(), req.header, headersSetter)
        let code: Code | undefined
        try {
          return await next(req)
        } catch (err) {
          code = err instanceof ConnectError ? err.code : Code.Unknown
          span.setStatus({ code: SpanStatusCode.ERROR })
          span.recordException(err instanceof Error ? err : String(err))
          throw err
        } finally {
          const statusCode = statusCodeToString(code)
          const completedAttributes: Attributes = {
            ...attributes,
            [ATTR_RPC_RESPONSE_STATUS_CODE]: statusCode,
            // @NOTE The convention requires `error.type` to be unset on
            // success, and to carry the status code on failure.
            ...(code !== undefined && { [ATTR_ERROR_TYPE]: statusCode }),
          }
          span.setAttributes(completedAttributes)
          rpcClientDuration.record(
            (performance.now() - start) / 1000,
            completedAttributes,
          )
          span.end()
        }
      },
    )
  }
}

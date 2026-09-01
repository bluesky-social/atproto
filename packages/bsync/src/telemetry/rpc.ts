import { performance } from 'node:perf_hooks'
import {
  Code,
  ConnectError,
  type HandlerContext,
  type ServiceImpl,
} from '@connectrpc/connect'
import {
  type Attributes,
  SpanStatusCode,
  ValueType,
  metrics,
  trace,
} from '@opentelemetry/api'
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions'
import {
  ATTR_RPC_METHOD,
  ATTR_RPC_RESPONSE_STATUS_CODE,
  ATTR_RPC_SYSTEM_NAME,
  METRIC_RPC_SERVER_CALL_DURATION,
  RPC_SYSTEM_NAME_VALUE_CONNECTRPC,
} from '@opentelemetry/semantic-conventions/incubating'
import { RPC_CALL_DURATION_BUCKETS } from '@atproto-labs/opentelemetry-node/conventions'
import { statusCodeToString } from '@atproto-labs/opentelemetry-node/util'
import type { Service } from '../proto/bsync_connect.js'

type ServiceMethods = Partial<ServiceImpl<typeof Service>>

/**
 * Derives extra attributes from a request. The returned attributes land on both
 * the duration histogram and the request span, so they must stay
 * low-cardinality: no DIDs, keys or URIs, which would explode the metric series.
 */
export type GetAttributes<M extends keyof ServiceMethods> = (
  request: Parameters<NonNullable<ServiceMethods[M]>>[0],
) => Attributes

const meter = metrics.getMeter('@atproto/bsync')
const rpcServerDuration = meter.createHistogram(
  METRIC_RPC_SERVER_CALL_DURATION,
  {
    description: 'Measures the duration of an incoming Remote Procedure Call',
    unit: 's',
    valueType: ValueType.DOUBLE,
    advice: { explicitBucketBoundaries: RPC_CALL_DURATION_BUCKETS },
  },
)

/**
 * Wraps every handler of a service implementation with server-side RPC
 * telemetry: an `rpc.server.call.duration` histogram, plus RPC attributes and
 * error status on the span the HTTP instrumentation already opened for the
 * request.
 *
 * The client half of the same call is recorded by the AppView, in
 * `@atproto/bsky`'s `createRpcClientInterceptor`. Both sides use the same
 * attribute keys, so queue time (client duration minus server duration) is a
 * subtraction rather than a join across differently-shaped series.
 *
 * @note Connect has no server-side counterpart to a client `Interceptor`, so
 * this wraps the implementations rather than plugging into the router.
 */
export const withRpcServerTelemetry = <T extends ServiceMethods>(
  methods: T,
  getAttributes?: { [M in keyof T]?: GetAttributes<M & keyof ServiceMethods> },
): T =>
  Object.fromEntries(
    Object.entries(methods).map(([name, impl]) => [
      name,
      instrument(impl as Handler, getAttributes?.[name as keyof T]),
    ]),
  ) as T

type Handler = (request: never, ctx: HandlerContext) => Promise<unknown>

const instrument = (
  impl: Handler,
  getAttributes?: (request: never) => Attributes,
): Handler =>
  async function (this: unknown, request, ctx) {
    // @NOTE The RPC convention requires `rpc.method` to be the fully-qualified
    // method name, so the service name is part of it rather than an attribute
    // of its own.
    const attributes: Attributes = {
      [ATTR_RPC_SYSTEM_NAME]: RPC_SYSTEM_NAME_VALUE_CONNECTRPC,
      [ATTR_RPC_METHOD]: `${ctx.service.typeName}/${ctx.method.name}`,
      ...getAttributes?.(request),
    }

    const span = trace.getActiveSpan()
    span?.setAttributes(attributes)

    const start = performance.now()
    let code: Code | undefined
    try {
      return await impl.call(this, request, ctx)
    } catch (err) {
      code = err instanceof ConnectError ? err.code : Code.Unknown
      span?.setStatus({ code: SpanStatusCode.ERROR })
      span?.recordException(err instanceof Error ? err : String(err))
      throw err
    } finally {
      const statusCode = statusCodeToString(code)
      rpcServerDuration.record((performance.now() - start) / 1000, {
        ...attributes,
        [ATTR_RPC_RESPONSE_STATUS_CODE]: statusCode,
        // @NOTE The convention requires `error.type` to be unset on success,
        // and to carry the status code on failure.
        ...(code !== undefined && { [ATTR_ERROR_TYPE]: statusCode }),
      })
    }
  }

import { Code, ConnectError, type Interceptor } from '@connectrpc/connect'
import {
  type Attributes,
  SpanKind,
  SpanStatusCode,
  type TextMapSetter,
  context,
  propagation,
  trace,
} from '@opentelemetry/api'

// OpenTelemetry RPC semantic convention attribute names, inlined to keep this
// module's runtime dependencies limited to @opentelemetry/api (so it stays a
// cheap no-op when no SDK is registered). Definitions:
// https://github.com/open-telemetry/semantic-conventions/blob/v1.41.1/docs/rpc/rpc-spans.md
// https://github.com/open-telemetry/semantic-conventions/blob/v1.41.1/docs/registry/attributes/rpc.md
const ATTR_RPC_SYSTEM = 'rpc.system'
const ATTR_RPC_SERVICE = 'rpc.service'
const ATTR_RPC_METHOD = 'rpc.method'
const ATTR_SERVER_ADDRESS = 'server.address'
const ATTR_SERVER_PORT = 'server.port'
const ATTR_PEER_SERVICE = 'peer.service'
const ATTR_RPC_GRPC_STATUS_CODE = 'rpc.grpc.status_code'
const ATTR_RPC_CONNECT_RPC_ERROR_CODE = 'rpc.connect_rpc.error_code'

const headersSetter: TextMapSetter<Headers> = {
  set: (headers, key, value) => headers.set(key, value),
}

export type TracingInterceptorOptions = {
  /**
   * The wire protocol of the transport this interceptor is attached to:
   * 'grpc' for createGrpcTransport, 'connect_rpc' for createConnectTransport.
   * Determines how errors are recorded (numeric "rpc.grpc.status_code" vs
   * string "rpc.connect_rpc.error_code") and lets tracing backends group and
   * render calls by protocol.
   */
  rpcSystem?: 'grpc' | 'connect_rpc'
  /**
   * Logical name of the remote service (the "peer"), e.g. 'atlantis'. Used by
   * tracing backends to label the callee in service maps when the remote's
   * own spans are missing (not instrumented, disabled, or sampled out). If
   * the remote reports its own telemetry, this must match its self-reported
   * service.name, or service maps will show two nodes for one service.
   */
  peerService?: string
}

/**
 * Creates client tracing spans for connect-rpc calls, following the
 * OpenTelemetry RPC semantic conventions. Needed because
 * "@opentelemetry/instrumentation-http" does not cover node:http2, which
 * connect's transports use.
 */
export const tracingInterceptor = (
  opts: TracingInterceptorOptions = {},
): Interceptor => {
  const { rpcSystem = 'connect_rpc', peerService } = opts
  const tracer = trace.getTracer('@atproto/bsky')
  return (next) => async (req) => {
    const attributes: Attributes = {
      [ATTR_RPC_SYSTEM]: rpcSystem,
      [ATTR_RPC_SERVICE]: req.service.typeName,
      [ATTR_RPC_METHOD]: req.method.name,
    }
    if (peerService) attributes[ATTR_PEER_SERVICE] = peerService
    try {
      const url = new URL(req.url)
      attributes[ATTR_SERVER_ADDRESS] = url.hostname
      if (url.port) attributes[ATTR_SERVER_PORT] = parseInt(url.port, 10)
    } catch {
      // ignore malformed URL
    }
    const span = tracer.startSpan(
      `${req.service.typeName}/${req.method.name}`,
      { kind: SpanKind.CLIENT, attributes },
    )
    const ctx = trace.setSpan(context.active(), span)
    // Propagate the trace context to the server (harmless if unconsumed).
    propagation.inject(ctx, req.header, headersSetter)
    try {
      // @NOTE For streaming responses this ends the span when the response
      // begins rather than when the stream is drained. All current RPCs are
      // unary, so this is only a theoretical imprecision.
      return await context.with(ctx, () => next(req))
    } catch (err) {
      if (err instanceof ConnectError) {
        // e.g. NotFound -> not_found (connect protocol error code string)
        const codeName = Code[err.code]
          ?.replace(/([a-z])([A-Z])/g, '$1_$2')
          .toLowerCase()
        if (rpcSystem === 'grpc') {
          span.setAttribute(ATTR_RPC_GRPC_STATUS_CODE, err.code)
        } else if (codeName) {
          span.setAttribute(ATTR_RPC_CONNECT_RPC_ERROR_CODE, codeName)
        }
        span.setStatus({ code: SpanStatusCode.ERROR, message: codeName })
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : undefined,
        })
      }
      throw err
    } finally {
      span.end()
    }
  }
}

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
const ATTR_RPC_SYSTEM_NAME = 'rpc.system.name'
const ATTR_RPC_METHOD = 'rpc.method'
const ATTR_SERVER_ADDRESS = 'server.address'
const ATTR_SERVER_PORT = 'server.port'
const ATTR_PEER_SERVICE = 'peer.service'
const ATTR_RPC_RESPONSE_STATUS_CODE = 'rpc.response.status_code'
const ATTR_ERROR_TYPE = 'error.type'
// Deprecated in v1.41.1 but still what the ecosystem emits (notably
// connectrpc.com/otelconnect, used by atlantis/vortex/courier). Dual-emitted
// alongside the current attributes so queries can join client and server
// spans; drop once the ecosystem catches up.
// @NOTE The old rpc.method is the *bare* method name; the current semconv
// redefines the same key as the fully-qualified name. They collide, so we
// emit the old form (matching otelconnect) — the fully-qualified name is
// available as the span name.
const DEPRECATED_ATTR_RPC_SYSTEM = 'rpc.system'
const DEPRECATED_ATTR_RPC_SERVICE = 'rpc.service'
const DEPRECATED_ATTR_RPC_GRPC_STATUS_CODE = 'rpc.grpc.status_code'
const DEPRECATED_ATTR_RPC_CONNECT_RPC_ERROR_CODE = 'rpc.connect_rpc.error_code'
// Not a semantic convention: bsky-specific, see TracingInterceptorOptions.
const ATTR_PEER_INTERFACE = 'peer.interface'

const headersSetter: TextMapSetter<Headers> = {
  set: (headers, key, value) => headers.set(key, value),
}

export type TracingInterceptorOptions = {
  /**
   * The wire protocol of the transport this interceptor is attached to:
   * 'grpc' for createGrpcTransport, 'connectrpc' for createConnectTransport.
   * Determines the casing of "rpc.response.status_code" values (gRPC status
   * names are UPPER_SNAKE, connect error codes are lower_snake) and lets
   * tracing backends group and render calls by protocol.
   */
  rpcSystem?: 'grpc' | 'connectrpc'
  /**
   * Logical name of the remote service (the "peer"), e.g. 'atlantis'. Used by
   * tracing backends to label the callee in service maps when the remote's
   * own spans are missing (not instrumented, disabled, or sampled out). If
   * the remote reports its own telemetry, this must match its self-reported
   * service.name, or service maps will show two nodes for one service.
   */
  peerService?: string
  /**
   * Name we know the remote interface by, when it differs from the service
   * that hosts it (e.g. 'bsync' is an interface handled by vortex). Recorded
   * as a "peer.interface" attribute (not a semantic convention).
   */
  peerInterface?: string
}

/**
 * Creates client tracing spans for connect-rpc calls, following the
 * OpenTelemetry RPC semantic conventions. Needed because
 * "@opentelemetry/instrumentation-http" does not cover node:http2, which
 * connect's transports use.
 *
 * Documented in docs/bsky/o11y.md — keep that file in sync when changing
 * the emitted attributes or the wired-up peer names.
 */
export const tracingInterceptor = (
  opts: TracingInterceptorOptions = {},
): Interceptor => {
  const { rpcSystem = 'connectrpc', peerService, peerInterface } = opts
  const tracer = trace.getTracer('@atproto/bsky')
  return (next) => async (req) => {
    // Fully-qualified, e.g. "bsky.Service/GetPostThread". Also the span name.
    const method = `${req.service.typeName}/${req.method.name}`
    const attributes: Attributes = {
      [ATTR_RPC_SYSTEM_NAME]: rpcSystem,
      [ATTR_RPC_METHOD]: req.method.name,
      [DEPRECATED_ATTR_RPC_SYSTEM]:
        rpcSystem === 'connectrpc' ? 'connect_rpc' : rpcSystem,
      [DEPRECATED_ATTR_RPC_SERVICE]: req.service.typeName,
    }
    if (peerService) attributes[ATTR_PEER_SERVICE] = peerService
    if (peerInterface) attributes[ATTR_PEER_INTERFACE] = peerInterface
    try {
      const url = new URL(req.url)
      attributes[ATTR_SERVER_ADDRESS] = url.hostname
      if (url.port) attributes[ATTR_SERVER_PORT] = parseInt(url.port, 10)
    } catch {
      // ignore malformed URL
    }
    const span = tracer.startSpan(method, {
      kind: SpanKind.CLIENT,
      attributes,
    })
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
        // e.g. NotFound -> NOT_FOUND (grpc) or not_found (connectrpc)
        const snake = Code[err.code]?.replace(/([a-z])([A-Z])/g, '$1_$2')
        const statusCode =
          rpcSystem === 'grpc' ? snake?.toUpperCase() : snake?.toLowerCase()
        if (statusCode) {
          span.setAttribute(ATTR_RPC_RESPONSE_STATUS_CODE, statusCode)
          span.setAttribute(ATTR_ERROR_TYPE, statusCode)
        }
        if (rpcSystem === 'grpc') {
          span.setAttribute(DEPRECATED_ATTR_RPC_GRPC_STATUS_CODE, err.code)
        } else if (snake) {
          span.setAttribute(
            DEPRECATED_ATTR_RPC_CONNECT_RPC_ERROR_CODE,
            snake.toLowerCase(),
          )
        }
        span.setStatus({ code: SpanStatusCode.ERROR, message: statusCode })
      } else {
        // Failed before a status code was returned (e.g. network error).
        if (err instanceof Error) span.setAttribute(ATTR_ERROR_TYPE, err.name)
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

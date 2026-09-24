export * from '@opentelemetry/semantic-conventions'

// @NOTE atproto-specific attribute keys, kept alongside the upstream re-export
// so consumers have a single import site for all resource/span attribute
// constants.
export const ATTR_XRPC_METHOD = 'xrpc.method'
export const ATTR_XRPC_PROXIED = 'xrpc.proxied'
export const ATTR_XRPC_PROXY = 'xrpc.proxy'

// @NOTE Both halves of a bsync call set these, the AppView on its client
// metrics and bsync on its handler metrics, so that the two can be plotted on
// the same dimensions. They live here rather than in either package so neither
// side can drift.
export const ATTR_BSYNC_NAMESPACE = 'bsync.namespace'
export const ATTR_BSYNC_OPERATION = 'bsync.operation'

/**
 * Bucket boundaries recommended by the RPC metrics semantic convention, in
 * seconds.
 *
 * @see {@link https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/}
 */
export const RPC_CALL_DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
]

import { Code } from '@connectrpc/connect'

/**
 * Bucket boundaries recommended by the RPC metrics semantic convention, in
 * seconds.
 *
 * @see {@link https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/}
 */
export const RPC_CALL_DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
]

/**
 * Renders a Connect status as the snake_case string the
 * `rpc.response.status_code` attribute expects. Success is spelled out here
 * because Connect's {@link Code} enum only enumerates errors.
 *
 * @note The AppView imports this to label its own client metrics, so that both
 * sides of a call can be plotted on the same dimensions.
 */
export const statusCodeToString = (code?: Code): string => {
  if (code === undefined) return 'ok'
  const name = Code[code]
  if (name === undefined) return String(code)
  return name.replace(/(?<=.)[A-Z]/g, (c) => `_${c}`).toLowerCase()
}

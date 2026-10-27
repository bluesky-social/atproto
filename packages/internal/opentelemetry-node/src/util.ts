/**
 * Numeric values of the Connect/gRPC `Code` enum, spelled out here so that
 * this package does not depend on `@connectrpc/connect`. Importing the
 * library here would load it before it gets instrumented, breaking the
 * instrumentation.
 *
 * @see {@link https://connectrpc.com/docs/protocol#error-codes}
 */
const CODE_NAMES: Record<number, string> = {
  1: 'Canceled',
  2: 'Unknown',
  3: 'InvalidArgument',
  4: 'DeadlineExceeded',
  5: 'NotFound',
  6: 'AlreadyExists',
  7: 'PermissionDenied',
  8: 'ResourceExhausted',
  9: 'FailedPrecondition',
  10: 'Aborted',
  11: 'OutOfRange',
  12: 'Unimplemented',
  13: 'Internal',
  14: 'Unavailable',
  15: 'DataLoss',
  16: 'Unauthenticated',
}

/**
 * Renders a Connect status as the snake_case string the
 * `rpc.response.status_code` attribute expects. Success is spelled out here
 * because the `Code` enum only enumerates errors.
 *
 * @note Both the caller and the callee of an RPC label their metrics with this,
 * so that the two halves of a call can be plotted on the same dimensions.
 */
export const statusCodeToString = (code?: number): string => {
  if (code === undefined) return 'ok'
  const name = CODE_NAMES[code]
  if (name === undefined) return String(code)
  return name.replace(/(?<=.)[A-Z]/g, (c) => `_${c}`).toLowerCase()
}

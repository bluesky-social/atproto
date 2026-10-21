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

const XRPC_PREFIX_LENGTH = 6 // "/xrpc/".length
const SHORTEST_CONCEIVABLE_NSID_LENGTH = 5 // "a.b.c"
const SHORTEST_CONCEIVABLE_XRPC_PATH_LENGTH =
  XRPC_PREFIX_LENGTH + SHORTEST_CONCEIVABLE_NSID_LENGTH

// @NOTE Hand-rolled (rather than using URL/split) because this runs on every
// instrumented request. Should become obsolete once we have dedicated
// XrpcClient/XrpcServer instrumentations.
export function extractUrlXrpcMethodName(url: unknown): string | undefined {
  if (typeof url !== 'string') {
    return undefined
  }

  if (
    // Ordered by likelihood of failure
    url.length < SHORTEST_CONCEIVABLE_XRPC_PATH_LENGTH ||
    url[5] !== '/' ||
    url[4] !== 'c' ||
    url[3] !== 'p' ||
    url[2] !== 'r' ||
    url[1] !== 'x' ||
    url[0] !== '/'
  ) {
    return undefined
  }

  const firstMethodCharPos = XRPC_PREFIX_LENGTH

  // Characters that can never open an NSID (note "_" skips "/xrpc/_health")
  const nextChar = url.charCodeAt(firstMethodCharPos)
  if (
    nextChar === 0x2e /* '.' */ ||
    nextChar === 0x2f /* '/' */ ||
    nextChar === 0x3f /* '?' */ ||
    nextChar === 0x5f /* '_' */
  ) {
    return undefined
  }

  const queryIndex = url.indexOf('?', firstMethodCharPos + 1) // nextChar was already searched for a "?" right above, so we can skip that char

  let lastMethodCharPos = queryIndex === -1 ? url.length - 1 : queryIndex - 1

  // Ignore the trailing slash, if there is one
  if (url.charCodeAt(lastMethodCharPos) === 0x2f /* '/' */) {
    lastMethodCharPos--
  }

  if (lastMethodCharPos + 1 < SHORTEST_CONCEIVABLE_XRPC_PATH_LENGTH) {
    return undefined
  }

  // Make sure there is no other slash in the path
  if (url.lastIndexOf('/', lastMethodCharPos) !== firstMethodCharPos - 1) {
    return undefined
  }

  // Require at least one dot, and not as the last character
  const lastDotPos = url.lastIndexOf('.', lastMethodCharPos)
  if (lastDotPos === -1 || lastDotPos === lastMethodCharPos) {
    return undefined
  }

  // @NOTE Only the domain authority is case-insensitive; the trailing name
  // segment is not, so it must be preserved as-is to avoid conflating
  // distinct NSIDs.
  return `${url.substring(firstMethodCharPos, lastDotPos).toLowerCase()}${url.substring(lastDotPos, lastMethodCharPos + 1)}`
}

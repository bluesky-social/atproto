import type { Attributes } from '@opentelemetry/api'
import { Method } from '../proto/bsync_pb.js'

/**
 * Attributes describing a stash operation.
 *
 * @note These attribute keys must match the ones the AppView sets on its own
 * client metrics (see `createBsyncClient` in @atproto/bsky), so that both sides
 * of a call can be plotted on the same dimensions.
 *
 * Both values are low-cardinality: the namespace is an NSID drawn from a fixed
 * set of record types, and the method is one of create/update/delete.
 */
export const operationAttributes = (op: {
  namespace: string
  method: Method
}): Attributes => ({
  'bsync.namespace': op.namespace,
  'bsync.operation': Method[op.method]?.toLowerCase() ?? 'unknown',
})

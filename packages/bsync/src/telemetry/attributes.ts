import type { Attributes } from '@opentelemetry/api'
import {
  ATTR_BSYNC_NAMESPACE,
  ATTR_BSYNC_OPERATION,
} from '@atproto-labs/opentelemetry-node/conventions'
import { Method } from '../proto/bsync_pb.js'

/**
 * Attributes describing a stash operation.
 *
 *
 * Both values are low-cardinality: the namespace is an NSID drawn from a fixed
 * set of record types, and the method is one of create/update/delete.
 */
export const operationAttributes = (op: {
  namespace: string
  method: Method
}): Attributes => ({
  [ATTR_BSYNC_NAMESPACE]: op.namespace,
  [ATTR_BSYNC_OPERATION]: Method[op.method]?.toLowerCase() ?? 'unknown',
})

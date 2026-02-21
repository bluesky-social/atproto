/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.defs'

export interface QueueView {
  $type?: 'tools.ozone.queue.defs#queueView'
  /** Queue ID */
  id: number
  /** Display name of the queue */
  name: string
  /** Subject types this queue accepts */
  subjectTypes: ('account' | 'record' | (string & {}))[]
  /** Collection name for record subjects (e.g., 'app.bsky.feed.post') */
  collection?: string
  /** Report reason types this queue accepts (fully qualified NSIDs) */
  reportTypes: string[]
  /** DID of moderator who created this queue */
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Whether this queue is currently active */
  enabled: boolean
  stats: QueueStats
}

const hashQueueView = 'queueView'

export function isQueueView<V>(v: V) {
  return is$typed(v, id, hashQueueView)
}

export function validateQueueView<V>(v: V) {
  return validate<QueueView & V>(v, id, hashQueueView)
}

export interface QueueStats {
  $type?: 'tools.ozone.queue.defs#queueStats'
  /** Number of reports in 'open' status */
  pendingCount: number
  /** Number of reports in 'closed' status */
  actionedCount: number
  /** Number of reports in 'escalated' status */
  escalatedPendingCount: number
  /** Number of distinct reporters with reports in this queue */
  uniqueReportersCount?: number
  /** Number of distinct subject DIDs with reports in this queue */
  uniqueSubjectsDidCount?: number
  /** Number of distinct subject DID+URI combinations in this queue */
  uniqueSubjectsFullCount?: number
  /** When these statistics were last computed */
  lastUpdated: string
}

const hashQueueStats = 'queueStats'

export function isQueueStats<V>(v: V) {
  return is$typed(v, id, hashQueueStats)
}

export function validateQueueStats<V>(v: V) {
  return validate<QueueStats & V>(v, id, hashQueueStats)
}

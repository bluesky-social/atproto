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
import type * as ToolsOzoneTeamDefs from '../team/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.defs'

export interface QueueView {
  $type?: 'tools.ozone.queue.defs#queueView'
  /** Queue ID */
  id: number
  /** Display name of the queue */
  name: string
  /** Subject types this queue accepts. */
  subjectTypes: ('account' | 'record' | 'message' | (string & {}))[]
  /** Collection name for record subjects (e.g., 'app.bsky.feed.post') */
  collection?: string
  /** Report reason types this queue accepts (fully qualified NSIDs) */
  reportTypes: string[]
  /** Optional description of the queue */
  description?: string
  /** DID of moderator who created this queue */
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Whether this queue is currently active */
  enabled: boolean
  /** When the queue was deleted, if applicable */
  deletedAt?: string
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
  /** Reports received in this queue in the last 24 hours. */
  inboundCount?: number
  /** Percentage of reports actioned (actionedCount / inboundCount * 100), rounded to nearest integer. Absent when inboundCount is 0. */
  actionRate?: number
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

export interface AssignmentView {
  $type?: 'tools.ozone.queue.defs#assignmentView'
  id: number
  did: string
  moderator?: ToolsOzoneTeamDefs.Member
  queue: QueueView
  startAt: string
  endAt: string
}

const hashAssignmentView = 'assignmentView'

export function isAssignmentView<V>(v: V) {
  return is$typed(v, id, hashAssignmentView)
}

export function validateAssignmentView<V>(v: V) {
  return validate<AssignmentView & V>(v, id, hashAssignmentView)
}

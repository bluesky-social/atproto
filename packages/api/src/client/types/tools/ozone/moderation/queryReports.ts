/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as ToolsOzoneModerationDefs from './defs.js'
import type * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.moderation.queryReports'

export type QueryParams = {
  /** Filter by queue ID. Use -1 for unassigned reports. */
  queueId?: number
  /** Filter by report types (fully qualified string in the format of com.atproto.moderation.defs#reason<name>). */
  reportTypes?: string[]
  /** Filter by report status. */
  status?: 'open' | 'closed' | 'escalated' | (string & {})
  /** Filter by subject DID or AT-URI. */
  subject?: string
  /** If specified, reports of the given type (account or record) will be returned. */
  subjectType?: 'account' | 'record' | (string & {})
  /** If specified, reports where the subject belongs to the given collections will be returned. When subjectType is set to 'account', this will be ignored. */
  collections?: string[]
  /** Retrieve reports created after a given timestamp */
  reportedAfter?: string
  /** Retrieve reports created before a given timestamp */
  reportedBefore?: string
  /** Filter by moderator who reviewed/actioned the report */
  reviewedBy?: string
  sortField?: 'createdAt' | 'updatedAt'
  sortDirection?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  reports: ReportView[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface ReportView {
  $type?: 'tools.ozone.moderation.queryReports#reportView'
  /** Report ID */
  id: number
  /** ID of the moderation event that created this report */
  eventId: number
  /** Queue ID this report is assigned to. Null = not yet assigned, -1 = no matching queue */
  queueId?: number
  /** Display name of the queue (if assigned) */
  queueName?: string
  /** Current status of the report */
  status: 'open' | 'closed' | 'escalated' | (string & {})
  subject: ToolsOzoneModerationDefs.SubjectView
  reportType: ComAtprotoModerationDefs.ReasonType
  /** DID of the user who made the report */
  reportedBy: string
  /** Comment provided by the reporter */
  comment?: string
  /** When the report was created */
  createdAt: string
  /** When the report was last updated */
  updatedAt?: string
  /** When the report was assigned to its current queue */
  queuedAt?: string
  /** Array of moderation event IDs representing actions taken on this report (sorted DESC, most recent first) */
  actionEventIds?: number[]
  /** Optional: expanded action events */
  actions?: ToolsOzoneModerationDefs.ModEventView[]
  /** Note sent to reporter when report was actioned */
  actionNote?: string
  subjectStatus?: ToolsOzoneModerationDefs.SubjectStatusView
  /** Number of other pending reports on the same subject */
  relatedReportCount?: number
  inReview?: ReportInReview
}

const hashReportView = 'reportView'

export function isReportView<V>(v: V) {
  return is$typed(v, id, hashReportView)
}

export function validateReportView<V>(v: V) {
  return validate<ReportView & V>(v, id, hashReportView)
}

export interface ReportInReview {
  $type?: 'tools.ozone.moderation.queryReports#reportInReview'
  moderatorDid: string
  moderatorHandle: string
  startedAt: string
}

const hashReportInReview = 'reportInReview'

export function isReportInReview<V>(v: V) {
  return is$typed(v, id, hashReportInReview)
}

export function validateReportInReview<V>(v: V) {
  return validate<ReportInReview & V>(v, id, hashReportInReview)
}

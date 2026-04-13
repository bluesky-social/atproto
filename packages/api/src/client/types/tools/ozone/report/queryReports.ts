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
import type * as ToolsOzoneReportDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.queryReports'

export type QueryParams = {
  /** Filter by queue ID. Use -1 for unassigned reports. */
  queueId?: number
  /** Filter by report types (fully qualified string in the format of com.atproto.moderation.defs#reason<name>). */
  reportTypes?: string[]
  /** Filter by report status. */
  status?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
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
  /** Filter by muted status. true returns only muted reports, false returns only unmuted reports. Defaults to false. */
  isMuted?: boolean
  /** Filter by moderator who reviewed/actioned the report */
  reviewedBy?: string
  /** Filter by the DID of the moderator permanently assigned to the report. */
  assignedTo?: string
  sortField?: 'createdAt' | 'updatedAt'
  sortDirection?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  reports: ToolsOzoneReportDefs.ReportView[]
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

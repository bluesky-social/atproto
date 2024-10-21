/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ToolsOzoneModerationDefs from './defs'

export interface QueryParams {
  /** All subjects belonging to the account specified in the 'subject' param will be returned. */
  includeAllUserRecords?: boolean
  /** The subject to get the status for. */
  subject?: string
  /** Search subjects by keyword from comments */
  comment?: string
  /** Search subjects reported after a given timestamp */
  reportedAfter?: string
  /** Search subjects reported before a given timestamp */
  reportedBefore?: string
  /** Search subjects reviewed after a given timestamp */
  reviewedAfter?: string
  /** Search subjects reviewed before a given timestamp */
  reviewedBefore?: string
  /** By default, we don't include muted subjects in the results. Set this to true to include them. */
  includeMuted?: boolean
  /** When set to true, only muted subjects and reporters will be returned. */
  onlyMuted?: boolean
  /** Specify when fetching subjects in a certain state */
  reviewState?: string
  ignoreSubjects?: string[]
  /** Get all subject statuses that were reviewed by a specific moderator */
  lastReviewedBy?: string
  sortField?: 'lastReviewedAt' | 'lastReportedAt'
  sortDirection?: 'asc' | 'desc'
  /** Get subjects that were taken down */
  takendown?: boolean
  /** Get subjects in unresolved appealed status */
  appealed?: boolean
  limit?: number
  tags?: string[]
  excludeTags?: string[]
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  subjectStatuses: ToolsOzoneModerationDefs.SubjectStatusView[]
  [k: string]: unknown
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

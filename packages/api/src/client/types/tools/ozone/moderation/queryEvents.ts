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
  /** The types of events (fully qualified string in the format of tools.ozone.moderation.defs#modEvent<name>) to filter by. If not specified, all events are returned. */
  types?: string[]
  createdBy?: string
  /** Sort direction for the events. Defaults to descending order of created at timestamp. */
  sortDirection?: 'asc' | 'desc'
  /** Retrieve events created after a given timestamp */
  createdAfter?: string
  /** Retrieve events created before a given timestamp */
  createdBefore?: string
  subject?: string
  /** If specified, only events where the subject belongs to the given collections will be returned. When subjectType is set to 'account', this will be ignored. */
  collections?: string[]
  /** If specified, only events where the subject is of the given type (account or record) will be returned. When this is set to 'account' the 'collections' parameter will be ignored. When includeAllUserRecords or subject is set, this will be ignored. */
  subjectType?: 'account' | 'record' | (string & {})
  /** If true, events on all record types (posts, lists, profile etc.) or records from given 'collections' param, owned by the did are returned. */
  includeAllUserRecords?: boolean
  limit?: number
  /** If true, only events with comments are returned */
  hasComment?: boolean
  /** If specified, only events with comments containing the keyword are returned */
  comment?: string
  /** If specified, only events where all of these labels were added are returned */
  addedLabels?: string[]
  /** If specified, only events where all of these labels were removed are returned */
  removedLabels?: string[]
  /** If specified, only events where all of these tags were added are returned */
  addedTags?: string[]
  /** If specified, only events where all of these tags were removed are returned */
  removedTags?: string[]
  reportTypes?: string[]
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  events: ToolsOzoneModerationDefs.ModEventView[]
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

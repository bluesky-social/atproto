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

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.moderation.queryEvents'

export type QueryParams = {
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
  /** If specified, only events with comments containing the keyword are returned. Apply || separator to use multiple keywords and match using OR condition. */
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
  policies?: string[]
  /** If specified, only events where the modTool name matches any of the given values are returned */
  modTool?: string[]
  /** If specified, only events where the age assurance state matches the given value are returned */
  ageAssuranceState?:
    | 'pending'
    | 'assured'
    | 'unknown'
    | 'reset'
    | 'blocked'
    | (string & {})
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  events: ToolsOzoneModerationDefs.ModEventView[]
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

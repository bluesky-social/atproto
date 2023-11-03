/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './defs'

export interface QueryParams {
  /** The type of event (fully qualified string in the format of com.atproto.admin#modEvent<name>) to filter by. If not specified, all events are returned. */
  type?: string
  createdBy?: string
  /** Sort direction for the events. Defaults to descending order of created at timestamp. */
  sortDirection?: 'asc' | 'desc'
  subject?: string
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  events: ComAtprotoAdminDefs.ModEventView[]
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

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
import type * as ComAtprotoSyncDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.sync.listHosts'

export type QueryParams = {
  limit?: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  /** Sort order is not formally specified. Recommended order is by time host was first seen by the server, with oldest first. */
  hosts: Host[]
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

export interface Host {
  $type?: 'com.atproto.sync.listHosts#host'
  /** hostname of server; not a URL (no scheme) */
  hostname: string
  /** Recent repo stream event sequence number. May be delayed from actual stream processing (eg, persisted cursor not in-memory cursor). */
  seq?: number
  accountCount?: number
  status?: ComAtprotoSyncDefs.HostStatus
}

const hashHost = 'host'

export function isHost<V>(v: V) {
  return is$typed(v, id, hashHost)
}

export function validateHost<V>(v: V) {
  return validate<Host & V>(v, id, hashHost)
}

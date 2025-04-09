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
const id = 'com.atproto.sync.getHostStatus'

export interface QueryParams {
  /** Hostname of the host (eg, PDS or relay) being queried. */
  hostname: string
}

export type InputSchema = undefined

export interface OutputSchema {
  hostname: string
  /** Recent repo stream event sequence number. May be delayed from actual stream processing (eg, persisted cursor not in-memory cursor). */
  seq?: number
  /** Number of accounts on the server which are associated with the upstream host. Note that the upstream may actually have more accounts. */
  accountCount?: number
  status?: ComAtprotoSyncDefs.HostStatus
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

export class HostNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'HostNotFound') return new HostNotFoundError(e)
  }

  return e
}

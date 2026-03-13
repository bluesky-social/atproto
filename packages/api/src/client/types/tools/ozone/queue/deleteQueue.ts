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

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.deleteQueue'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the queue to delete */
  queueId: number
  /** Optional: migrate all reports to this queue. If not specified, reports will be set to unassigned (-1). */
  migrateToQueueId?: number
}

export interface OutputSchema {
  deleted: boolean
  /** Number of reports that were migrated (if migration occurred) */
  reportsMigrated?: number
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

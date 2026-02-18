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
import type * as ToolsOzoneQueueDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.createQueue'

export type QueryParams = {}

export interface InputSchema {
  /** Display name for the queue (must be unique) */
  name: string
  /** Subject types this queue accepts */
  subjectTypes: ('account' | 'record' | (string & {}))[]
  /** Collection name for record subjects. Required if subjectTypes includes 'record'. */
  collection?: string
  /** Report reason types (fully qualified NSIDs) */
  reportTypes: string[]
}

export interface OutputSchema {
  queue: ToolsOzoneQueueDefs.QueueView
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

export class ConflictingQueueError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'ConflictingQueue') return new ConflictingQueueError(e)
  }

  return e
}

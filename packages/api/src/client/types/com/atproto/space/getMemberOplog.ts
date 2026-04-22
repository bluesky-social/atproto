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
const id = 'com.atproto.space.getMemberOplog'

export type QueryParams = {
  /** Reference to the space. */
  space: string
  /** Return operations after this revision. */
  since?: string
  /** Maximum number of operations to return. */
  limit?: number
}
export type InputSchema = undefined

export interface OutputSchema {
  ops: OpEntry[]
  /** Current hex-encoded set hash. */
  setHash?: string
  /** Current revision. */
  rev?: string
  cursor?: string
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

export class SpaceNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'SpaceNotFound') return new SpaceNotFoundError(e)
  }

  return e
}

export interface OpEntry {
  $type?: 'com.atproto.space.getMemberOplog#opEntry'
  rev: string
  idx: number
  action: 'add' | 'remove' | (string & {})
  did: string
}

const hashOpEntry = 'opEntry'

export function isOpEntry<V>(v: V) {
  return is$typed(v, id, hashOpEntry)
}

export function validateOpEntry<V>(v: V) {
  return validate<OpEntry & V>(v, id, hashOpEntry)
}

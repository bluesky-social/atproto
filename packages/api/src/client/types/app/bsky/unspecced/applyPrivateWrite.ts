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
const id = 'app.bsky.unspecced.applyPrivateWrite'

export interface QueryParams {}

export interface InputSchema {
  write: $Typed<Create> | $Typed<Delete>
}

export interface OutputSchema {
  result?: $Typed<CreateResult> | $Typed<DeleteResult>
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

/** Operation which creates a new record. */
export interface Create {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#create'
  collection: string
  rkey?: string
  value: { [_ in string]: unknown }
}

const hashCreate = 'create'

export function isCreate<V>(v: V) {
  return is$typed(v, id, hashCreate)
}

export function validateCreate<V>(v: V) {
  return validate<Create & V>(v, id, hashCreate)
}

/** Operation which creates a new record. */
export interface Delete {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#delete'
  collection: string
  rkey: string
}

const hashDelete = 'delete'

export function isDelete<V>(v: V) {
  return is$typed(v, id, hashDelete)
}

export function validateDelete<V>(v: V) {
  return validate<Delete & V>(v, id, hashDelete)
}

export interface CreateResult {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#createResult'
  rkey: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
}

const hashCreateResult = 'createResult'

export function isCreateResult<V>(v: V) {
  return is$typed(v, id, hashCreateResult)
}

export function validateCreateResult<V>(v: V) {
  return validate<CreateResult & V>(v, id, hashCreateResult)
}

export interface DeleteResult {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#deleteResult'
  rkey: string
}

const hashDeleteResult = 'deleteResult'

export function isDeleteResult<V>(v: V) {
  return is$typed(v, id, hashDeleteResult)
}

export function validateDeleteResult<V>(v: V) {
  return validate<DeleteResult & V>(v, id, hashDeleteResult)
}

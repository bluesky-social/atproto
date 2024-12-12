/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoRepoDefs from './defs'

const id = 'com.atproto.repo.applyWrites'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo (aka, current account). */
  repo: string
  /** Can be set to 'false' to skip Lexicon schema validation of record data across all operations, 'true' to require it, or leave unset to validate only for known Lexicons. */
  validate?: boolean
  writes: (Create | Update | Delete)[]
  /** If provided, the entire operation will fail if the current repo commit CID does not match this value. Used to prevent conflicting repo mutations. */
  swapCommit?: string
  [k: string]: unknown
}

export interface OutputSchema {
  commit?: ComAtprotoRepoDefs.CommitMeta
  results?: (CreateResult | UpdateResult | DeleteResult)[]
  [k: string]: unknown
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

export class InvalidSwapError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidSwap') return new InvalidSwapError(e)
  }

  return e
}

/** Operation which creates a new record. */
export interface Create {
  collection: string
  rkey?: string
  value: {}
  [k: string]: unknown
}

export function isCreate(
  v: unknown,
): v is Create & { $type: $Type<'com.atproto.repo.applyWrites', 'create'> } {
  return is$typed(v, id, 'create')
}

export function validateCreate(v: unknown) {
  return lexicons.validate(`${id}#create`, v) as ValidationResult<Create>
}

/** Operation which updates an existing record. */
export interface Update {
  collection: string
  rkey: string
  value: {}
  [k: string]: unknown
}

export function isUpdate(
  v: unknown,
): v is Update & { $type: $Type<'com.atproto.repo.applyWrites', 'update'> } {
  return is$typed(v, id, 'update')
}

export function validateUpdate(v: unknown) {
  return lexicons.validate(`${id}#update`, v) as ValidationResult<Update>
}

/** Operation which deletes an existing record. */
export interface Delete {
  collection: string
  rkey: string
  [k: string]: unknown
}

export function isDelete(
  v: unknown,
): v is Delete & { $type: $Type<'com.atproto.repo.applyWrites', 'delete'> } {
  return is$typed(v, id, 'delete')
}

export function validateDelete(v: unknown) {
  return lexicons.validate(`${id}#delete`, v) as ValidationResult<Delete>
}

export interface CreateResult {
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
  [k: string]: unknown
}

export function isCreateResult(v: unknown): v is CreateResult & {
  $type: $Type<'com.atproto.repo.applyWrites', 'createResult'>
} {
  return is$typed(v, id, 'createResult')
}

export function validateCreateResult(v: unknown) {
  return lexicons.validate(
    `${id}#createResult`,
    v,
  ) as ValidationResult<CreateResult>
}

export interface UpdateResult {
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
  [k: string]: unknown
}

export function isUpdateResult(v: unknown): v is UpdateResult & {
  $type: $Type<'com.atproto.repo.applyWrites', 'updateResult'>
} {
  return is$typed(v, id, 'updateResult')
}

export function validateUpdateResult(v: unknown) {
  return lexicons.validate(
    `${id}#updateResult`,
    v,
  ) as ValidationResult<UpdateResult>
}

export interface DeleteResult {
  [k: string]: unknown
}

export function isDeleteResult(v: unknown): v is DeleteResult & {
  $type: $Type<'com.atproto.repo.applyWrites', 'deleteResult'>
} {
  return is$typed(v, id, 'deleteResult')
}

export function validateDeleteResult(v: unknown) {
  return lexicons.validate(
    `${id}#deleteResult`,
    v,
  ) as ValidationResult<DeleteResult>
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoRepoDefs from './defs'

export const id = 'com.atproto.repo.applyWrites'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo (aka, current account). */
  repo: string
  /** Can be set to 'false' to skip Lexicon schema validation of record data across all operations, 'true' to require it, or leave unset to validate only for known Lexicons. */
  validate?: boolean
  writes: ($Typed<Create> | $Typed<Update> | $Typed<Delete>)[]
  /** If provided, the entire operation will fail if the current repo commit CID does not match this value. Used to prevent conflicting repo mutations. */
  swapCommit?: string
}

export interface OutputSchema {
  commit?: ComAtprotoRepoDefs.CommitMeta
  results?: (
    | $Typed<CreateResult>
    | $Typed<UpdateResult>
    | $Typed<DeleteResult>
  )[]
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
  $type?: $Type<'com.atproto.repo.applyWrites', 'create'>
  collection: string
  rkey?: string
  value: { [_ in string]: unknown }
}

export function isCreate<V>(v: V) {
  return is$typed(v, id, 'create')
}

export function validateCreate(v: unknown) {
  return lexicons.validate(`${id}#create`, v) as ValidationResult<Create>
}

export function isValidCreate<V>(v: V): v is V & $Typed<Create> {
  return isCreate(v) && validateCreate(v).success
}

/** Operation which updates an existing record. */
export interface Update {
  $type?: $Type<'com.atproto.repo.applyWrites', 'update'>
  collection: string
  rkey: string
  value: { [_ in string]: unknown }
}

export function isUpdate<V>(v: V) {
  return is$typed(v, id, 'update')
}

export function validateUpdate(v: unknown) {
  return lexicons.validate(`${id}#update`, v) as ValidationResult<Update>
}

export function isValidUpdate<V>(v: V): v is V & $Typed<Update> {
  return isUpdate(v) && validateUpdate(v).success
}

/** Operation which deletes an existing record. */
export interface Delete {
  $type?: $Type<'com.atproto.repo.applyWrites', 'delete'>
  collection: string
  rkey: string
}

export function isDelete<V>(v: V) {
  return is$typed(v, id, 'delete')
}

export function validateDelete(v: unknown) {
  return lexicons.validate(`${id}#delete`, v) as ValidationResult<Delete>
}

export function isValidDelete<V>(v: V): v is V & $Typed<Delete> {
  return isDelete(v) && validateDelete(v).success
}

export interface CreateResult {
  $type?: $Type<'com.atproto.repo.applyWrites', 'createResult'>
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
}

export function isCreateResult<V>(v: V) {
  return is$typed(v, id, 'createResult')
}

export function validateCreateResult(v: unknown) {
  return lexicons.validate(
    `${id}#createResult`,
    v,
  ) as ValidationResult<CreateResult>
}

export function isValidCreateResult<V>(v: V): v is V & $Typed<CreateResult> {
  return isCreateResult(v) && validateCreateResult(v).success
}

export interface UpdateResult {
  $type?: $Type<'com.atproto.repo.applyWrites', 'updateResult'>
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
}

export function isUpdateResult<V>(v: V) {
  return is$typed(v, id, 'updateResult')
}

export function validateUpdateResult(v: unknown) {
  return lexicons.validate(
    `${id}#updateResult`,
    v,
  ) as ValidationResult<UpdateResult>
}

export function isValidUpdateResult<V>(v: V): v is V & $Typed<UpdateResult> {
  return isUpdateResult(v) && validateUpdateResult(v).success
}

export interface DeleteResult {
  $type?: $Type<'com.atproto.repo.applyWrites', 'deleteResult'>
}

export function isDeleteResult<V>(v: V) {
  return is$typed(v, id, 'deleteResult')
}

export function validateDeleteResult(v: unknown) {
  return lexicons.validate(
    `${id}#deleteResult`,
    v,
  ) as ValidationResult<DeleteResult>
}

export function isValidDeleteResult<V>(v: V): v is V & $Typed<DeleteResult> {
  return isDeleteResult(v) && validateDeleteResult(v).success
}

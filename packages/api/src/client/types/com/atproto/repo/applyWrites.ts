/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoDefs from './defs'

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

export function isCreate(v: unknown): v is Create {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#create'
  )
}

export function validateCreate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#create', v)
}

/** Operation which updates an existing record. */
export interface Update {
  collection: string
  rkey: string
  value: {}
  [k: string]: unknown
}

export function isUpdate(v: unknown): v is Update {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#update'
  )
}

export function validateUpdate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#update', v)
}

/** Operation which deletes an existing record. */
export interface Delete {
  collection: string
  rkey: string
  [k: string]: unknown
}

export function isDelete(v: unknown): v is Delete {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#delete'
  )
}

export function validateDelete(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#delete', v)
}

export interface CreateResult {
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
  [k: string]: unknown
}

export function isCreateResult(v: unknown): v is CreateResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#createResult'
  )
}

export function validateCreateResult(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#createResult', v)
}

export interface UpdateResult {
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
  [k: string]: unknown
}

export function isUpdateResult(v: unknown): v is UpdateResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#updateResult'
  )
}

export function validateUpdateResult(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#updateResult', v)
}

export interface DeleteResult {
  [k: string]: unknown
}

export function isDeleteResult(v: unknown): v is DeleteResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#deleteResult'
  )
}

export function validateDeleteResult(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#deleteResult', v)
}

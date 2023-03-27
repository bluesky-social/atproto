/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo. */
  repo: string
  /** Validate the records? */
  validate?: boolean
  writes: (Create | Update | Delete)[]
  swapCommit?: string
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
}

export class InvalidSwapError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidSwap') return new InvalidSwapError(e)
  }
  return e
}

/** Create a new record. */
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

/** Update an existing record. */
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

/** Delete an existing record. */
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

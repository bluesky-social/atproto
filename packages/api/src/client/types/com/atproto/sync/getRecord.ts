/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  /** The DID of the repo. */
  did: string
  collection: string
  /** Record Key */
  rkey: string
  /** DEPRECATED: referenced a repo commit by CID, and retrieved record as of that commit */
  commit?: string
}

export type InputSchema = undefined

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: Uint8Array
}

export class RecordNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class RepoNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class RepoTakendownError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class RepoSuspendedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class RepoDeactivatedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'RecordNotFound') return new RecordNotFoundError(e)
    if (e.error === 'RepoNotFound') return new RepoNotFoundError(e)
    if (e.error === 'RepoTakendown') return new RepoTakendownError(e)
    if (e.error === 'RepoSuspended') return new RepoSuspendedError(e)
    if (e.error === 'RepoDeactivated') return new RepoDeactivatedError(e)
  }
  return e
}

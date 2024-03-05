/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  /** The handle or DID of the repo. */
  did: string
}

export type InputSchema = undefined

export interface OutputSchema {
  did: string
  active: boolean
  /** If active=false, this optional field indicates a reason for why the account is not active. */
  status?:
    | 'com.atproto.sync.defs#takendown'
    | 'com.atproto.sync.defs#suspended'
    | 'com.atproto.sync.defs#deactivated'
    | (string & {})
  /** Optional field, the current rev of the repo, if active=true */
  rev?: string
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export class RepoNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'RepoNotFound') return new RepoNotFoundError(e)
  }
  return e
}

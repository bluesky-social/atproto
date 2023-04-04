/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  includeUsed?: boolean
  createAvailable?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  codes: Invite[]
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

export class DuplicateCreateError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'DuplicateCreate') return new DuplicateCreateError(e)
  }
  return e
}

export interface Invite {
  code: string
  available: number
  uses: number
  [k: string]: unknown
}

export function isInvite(v: unknown): v is Invite {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.getUserInviteCodes#invite'
  )
}

export function validateInvite(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.server.getUserInviteCodes#invite', v)
}

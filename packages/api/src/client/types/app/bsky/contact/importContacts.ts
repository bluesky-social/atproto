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
import type * as AppBskyContactDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.contact.importContacts'

export type QueryParams = {}

export interface InputSchema {
  /** JWT to authenticate the call. Use the JWT received as a response to the call to `app.bsky.contact.verifyPhone`. */
  token: string
  /** List of phone numbers in global E.164 format (e.g., '+12125550123'). Phone numbers that cannot be normalized into a valid phone number will be discarded. Should not repeat the 'phone' input used in `app.bsky.contact.verifyPhone`. */
  contacts: string[]
}

export interface OutputSchema {
  /** The users that matched during import and their indexes on the input contacts, so the client can correlate with its local list. */
  matchesAndContactIndexes: AppBskyContactDefs.MatchAndContactIndex[]
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

export class InvalidDidError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidContactsError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class TooManyContactsError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidTokenError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InternalError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidDid') return new InvalidDidError(e)
    if (e.error === 'InvalidContacts') return new InvalidContactsError(e)
    if (e.error === 'TooManyContacts') return new TooManyContactsError(e)
    if (e.error === 'InvalidToken') return new InvalidTokenError(e)
    if (e.error === 'InternalError') return new InternalError(e)
  }

  return e
}

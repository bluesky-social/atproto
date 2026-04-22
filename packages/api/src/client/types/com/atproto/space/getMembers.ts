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
const id = 'com.atproto.space.getMembers'

export type QueryParams = {
  /** Reference to the space. */
  space: string
}
export type InputSchema = undefined

export interface OutputSchema {
  members: Member[]
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

export interface Member {
  $type?: 'com.atproto.space.getMembers#member'
  did: string
  addedAt: string
}

const hashMember = 'member'

export function isMember<V>(v: V) {
  return is$typed(v, id, hashMember)
}

export function validateMember<V>(v: V) {
  return validate<Member & V>(v, id, hashMember)
}

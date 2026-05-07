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
import type * as ChatBskyGroupDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.group.createJoinLink'

export type QueryParams = {}

export interface InputSchema {
  convoId: string
  requireApproval?: boolean
  joinRule: ChatBskyGroupDefs.JoinRule
}

export interface OutputSchema {
  joinLink: ChatBskyGroupDefs.JoinLinkView
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

export class EnabledJoinLinkAlreadyExistsError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidConvoError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InsufficientRoleError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'EnabledJoinLinkAlreadyExists')
      return new EnabledJoinLinkAlreadyExistsError(e)
    if (e.error === 'InvalidConvo') return new InvalidConvoError(e)
    if (e.error === 'InsufficientRole') return new InsufficientRoleError(e)
  }

  return e
}

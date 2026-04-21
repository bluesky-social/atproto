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
import type * as ChatBskyConvoDefs from '../convo/defs.js'
import type * as ChatBskyActorDefs from '../actor/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.group.addMembers'

export type QueryParams = {}

export interface InputSchema {
  convoId: string
  members: string[]
}

export interface OutputSchema {
  convo: ChatBskyConvoDefs.ConvoView
  addedMembers?: ChatBskyActorDefs.ProfileViewBasic[]
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

export class AccountSuspendedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class BlockedActorError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class GroupInvitesDisabledError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class ConvoLockedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InsufficientRoleError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidConvoError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class MemberLimitReachedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class NotFollowedBySenderError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class RecipientNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AccountSuspended') return new AccountSuspendedError(e)
    if (e.error === 'BlockedActor') return new BlockedActorError(e)
    if (e.error === 'GroupInvitesDisabled')
      return new GroupInvitesDisabledError(e)
    if (e.error === 'ConvoLocked') return new ConvoLockedError(e)
    if (e.error === 'InsufficientRole') return new InsufficientRoleError(e)
    if (e.error === 'InvalidConvo') return new InvalidConvoError(e)
    if (e.error === 'MemberLimitReached') return new MemberLimitReachedError(e)
    if (e.error === 'NotFollowedBySender')
      return new NotFollowedBySenderError(e)
    if (e.error === 'RecipientNotFound') return new RecipientNotFoundError(e)
  }

  return e
}

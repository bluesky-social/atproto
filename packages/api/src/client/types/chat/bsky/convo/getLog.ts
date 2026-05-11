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
import type * as ChatBskyConvoDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.convo.getLog'

export type QueryParams = {
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  logs: (
    | $Typed<ChatBskyConvoDefs.LogBeginConvo>
    | $Typed<ChatBskyConvoDefs.LogAcceptConvo>
    | $Typed<ChatBskyConvoDefs.LogLeaveConvo>
    | $Typed<ChatBskyConvoDefs.LogMuteConvo>
    | $Typed<ChatBskyConvoDefs.LogUnmuteConvo>
    | $Typed<ChatBskyConvoDefs.LogCreateMessage>
    | $Typed<ChatBskyConvoDefs.LogDeleteMessage>
    | $Typed<ChatBskyConvoDefs.LogReadMessage>
    | $Typed<ChatBskyConvoDefs.LogAddReaction>
    | $Typed<ChatBskyConvoDefs.LogRemoveReaction>
    | $Typed<ChatBskyConvoDefs.LogReadConvo>
    | $Typed<ChatBskyConvoDefs.LogAddMember>
    | $Typed<ChatBskyConvoDefs.LogRemoveMember>
    | $Typed<ChatBskyConvoDefs.LogMemberJoin>
    | $Typed<ChatBskyConvoDefs.LogMemberLeave>
    | $Typed<ChatBskyConvoDefs.LogLockConvo>
    | $Typed<ChatBskyConvoDefs.LogUnlockConvo>
    | $Typed<ChatBskyConvoDefs.LogLockConvoPermanently>
    | $Typed<ChatBskyConvoDefs.LogEditGroup>
    | $Typed<ChatBskyConvoDefs.LogCreateJoinLink>
    | $Typed<ChatBskyConvoDefs.LogEditJoinLink>
    | $Typed<ChatBskyConvoDefs.LogEnableJoinLink>
    | $Typed<ChatBskyConvoDefs.LogDisableJoinLink>
    | $Typed<ChatBskyConvoDefs.LogIncomingJoinRequest>
    | $Typed<ChatBskyConvoDefs.LogApproveJoinRequest>
    | $Typed<ChatBskyConvoDefs.LogRejectJoinRequest>
    | $Typed<ChatBskyConvoDefs.LogOutgoingJoinRequest>
    | { $type: string }
  )[]
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

export function toKnownErr(e: any) {
  return e
}

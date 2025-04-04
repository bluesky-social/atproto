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

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.moderation.getMessageContext'

export interface QueryParams {
  /** Conversation that the message is from. NOTE: this field will eventually be required. */
  convoId?: string
  messageId: string
  before?: number
  after?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  messages: (
    | $Typed<ChatBskyConvoDefs.MessageView>
    | $Typed<ChatBskyConvoDefs.DeletedMessageView>
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

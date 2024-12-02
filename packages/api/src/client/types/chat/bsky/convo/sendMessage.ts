/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ChatBskyConvoDefs from './defs'

export const id = 'chat.bsky.convo.sendMessage'

export interface QueryParams {}

export interface InputSchema {
  convoId: string
  message: ChatBskyConvoDefs.MessageInput
}

export type OutputSchema = ChatBskyConvoDefs.MessageView

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

export function toKnownErr(e: any) {
  return e
}

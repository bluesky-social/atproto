/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ChatBskyConvoDefs from '../convo/defs'

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
    | ChatBskyConvoDefs.MessageView
    | ChatBskyConvoDefs.DeletedMessageView
    | { $type: string; [k: string]: unknown }
  )[]
  [k: string]: unknown
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

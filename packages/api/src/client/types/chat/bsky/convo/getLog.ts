/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as ChatBskyConvoDefs from './defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'chat.bsky.convo.getLog'

export interface QueryParams {
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  logs: (
    | $Typed<ChatBskyConvoDefs.LogBeginConvo>
    | $Typed<ChatBskyConvoDefs.LogLeaveConvo>
    | $Typed<ChatBskyConvoDefs.LogCreateMessage>
    | $Typed<ChatBskyConvoDefs.LogDeleteMessage>
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

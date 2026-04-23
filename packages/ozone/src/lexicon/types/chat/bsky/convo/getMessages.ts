/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as ChatBskyConvoDefs from './defs.js'
import type * as ChatBskyActorDefs from '../actor/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.convo.getMessages'

export type QueryParams = {
  convoId: string
  limit: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  messages: (
    | $Typed<ChatBskyConvoDefs.MessageView>
    | $Typed<ChatBskyConvoDefs.DeletedMessageView>
    | $Typed<ChatBskyConvoDefs.SystemMessageView>
    | { $type: string }
  )[]
  /** Set of all members who authored or reacted to the returned messages. Members referred to by system messages are also included. */
  relatedProfiles?: ChatBskyActorDefs.ProfileViewBasic[]
}

export type HandlerInput = void

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'InvalidConvo'
}

export type HandlerOutput = HandlerError | HandlerSuccess

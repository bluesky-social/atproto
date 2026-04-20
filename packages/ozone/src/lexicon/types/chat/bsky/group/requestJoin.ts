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
import type * as ChatBskyConvoDefs from '../convo/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.group.requestJoin'

export type QueryParams = {}

export interface InputSchema {
  code: string
}

export interface OutputSchema {
  status: 'joined' | 'pending' | (string & {})
  convo?: ChatBskyConvoDefs.ConvoView
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?:
    | 'ConvoLocked'
    | 'FollowRequired'
    | 'InvalidCode'
    | 'LinkDisabled'
    | 'MemberLimitReached'
    | 'UserKicked'
}

export type HandlerOutput = HandlerError | HandlerSuccess

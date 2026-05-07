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
import type * as ChatBskyGroupDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.group.getGroupPublicInfo'

export type QueryParams = {
  code: string
}
export type InputSchema = undefined

export interface OutputSchema {
  group: ChatBskyGroupDefs.GroupPublicView
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
  error?: 'InvalidCode'
}

export type HandlerOutput = HandlerError | HandlerSuccess

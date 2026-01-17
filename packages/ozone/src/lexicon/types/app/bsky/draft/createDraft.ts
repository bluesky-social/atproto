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
import type * as AppBskyDraftDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.draft.createDraft'

export type QueryParams = {}

export interface InputSchema {
  draft: AppBskyDraftDefs.Draft
}

export interface OutputSchema {
  /** The ID of the created draft. */
  id: string
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
  error?: 'DraftLimitReached'
}

export type HandlerOutput = HandlerError | HandlerSuccess

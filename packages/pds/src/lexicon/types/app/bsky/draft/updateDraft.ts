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
const id = 'app.bsky.draft.updateDraft'

export type QueryParams = {}

export interface InputSchema {
  draft: AppBskyDraftDefs.DraftWithId
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | void

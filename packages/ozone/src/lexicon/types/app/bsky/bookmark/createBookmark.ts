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

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.bookmark.createBookmark'

export type QueryParams = {}

export interface InputSchema {
  /** The at-uri of the record to be bookmarked. Currently, only `app.bsky.feed.post` records are supported. */
  uri: string
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'Duplicated' | 'UnsupportedCollection'
}

export type HandlerOutput = HandlerError | void

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
import type * as AppBskyFeedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.getAuthorFeed'

export type QueryParams = {
  actor: string
  limit: number
  cursor?: string
  /** Combinations of post/repost types to include in response. */
  filter:
    | 'posts_with_replies'
    | 'posts_no_replies'
    | 'posts_with_media'
    | 'posts_and_author_threads'
    | 'posts_with_video'
    | (string & {})
  includePins: boolean
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  feed: AppBskyFeedDefs.FeedViewPost[]
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
  error?: 'BlockedActor' | 'BlockedByActor'
}

export type HandlerOutput = HandlerError | HandlerSuccess

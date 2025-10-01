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
import type * as AppBskyActorDefs from '../actor/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.bookmark.getModBookmarksBySubject'

export type QueryParams = {
  /** AT-URI of the subject (eg, a post record). */
  subject: string
  limit: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  bookmarks: Bookmark[]
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
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface Bookmark {
  $type?: 'app.bsky.bookmark.getModBookmarksBySubject#bookmark'
  indexedAt: string
  actor: AppBskyActorDefs.ProfileView
}

const hashBookmark = 'bookmark'

export function isBookmark<V>(v: V) {
  return is$typed(v, id, hashBookmark)
}

export function validateBookmark<V>(v: V) {
  return validate<Bookmark & V>(v, id, hashBookmark)
}

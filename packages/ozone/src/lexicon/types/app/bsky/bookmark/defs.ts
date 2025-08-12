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
const id = 'app.bsky.bookmark.defs'

/** Object used to store bookmark data in stash. */
export interface Bookmark {
  $type?: 'app.bsky.bookmark.defs#bookmark'
  /** The at-uri of the record to be bookmarked. Currently, only `app.bsky.feed.post` records are supported. */
  uri: string
}

const hashBookmark = 'bookmark'

export function isBookmark<V>(v: V) {
  return is$typed(v, id, hashBookmark)
}

export function validateBookmark<V>(v: V) {
  return validate<Bookmark & V>(v, id, hashBookmark)
}

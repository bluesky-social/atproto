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
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'
import type * as AppBskyFeedDefs from '../feed/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.bookmark.defs'

/** Object used to store bookmark data in stash. */
export interface Bookmark {
  $type?: 'app.bsky.bookmark.defs#bookmark'
  subject: ComAtprotoRepoStrongRef.Main
}

const hashBookmark = 'bookmark'

export function isBookmark<V>(v: V) {
  return is$typed(v, id, hashBookmark)
}

export function validateBookmark<V>(v: V) {
  return validate<Bookmark & V>(v, id, hashBookmark)
}

export interface BookmarkView {
  $type?: 'app.bsky.bookmark.defs#bookmarkView'
  subject: ComAtprotoRepoStrongRef.Main
  createdAt?: string
  item:
    | $Typed<AppBskyFeedDefs.BlockedPost>
    | $Typed<AppBskyFeedDefs.NotFoundPost>
    | $Typed<AppBskyFeedDefs.PostView>
    | { $type: string }
}

const hashBookmarkView = 'bookmarkView'

export function isBookmarkView<V>(v: V) {
  return is$typed(v, id, hashBookmarkView)
}

export function validateBookmarkView<V>(v: V) {
  return validate<BookmarkView & V>(v, id, hashBookmarkView)
}

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
import type * as AppSokaaEmbedVideo from '../embed/video.js'
import type * as AppSokaaEmbedImages from '../embed/images.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.sokaa.feed.post'

export interface Main {
  $type: 'app.sokaa.feed.post'
  /** Optional caption displayed below the media. */
  caption?: string
  media:
    | $Typed<AppSokaaEmbedVideo.Main>
    | $Typed<AppSokaaEmbedImages.Main>
    | { $type: string }
  /** Hashtags associated with the post. */
  tags?: string[]
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}

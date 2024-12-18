/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'

const id = 'app.bsky.embed.defs'

/** width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit. */
export interface AspectRatio {
  width: number
  height: number
  [k: string]: unknown
}

export function isAspectRatio(
  v: unknown,
): v is AspectRatio & { $type: $Type<'app.bsky.embed.defs', 'aspectRatio'> } {
  return is$typed(v, id, 'aspectRatio')
}

export function validateAspectRatio(v: unknown) {
  return lexicons.validate(
    `${id}#aspectRatio`,
    v,
  ) as ValidationResult<AspectRatio>
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'app.bsky.embed.defs'

/** width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit. */
export interface AspectRatio {
  $type?: $Type<'app.bsky.embed.defs', 'aspectRatio'>
  width: number
  height: number
}

export function isAspectRatio<V>(v: V) {
  return is$typed(v, id, 'aspectRatio')
}

export function validateAspectRatio(v: unknown) {
  return lexicons.validate(
    `${id}#aspectRatio`,
    v,
  ) as ValidationResult<AspectRatio>
}

export function isValidAspectRatio<V>(v: V): v is V & $Typed<AspectRatio> {
  return isAspectRatio(v) && validateAspectRatio(v).success
}

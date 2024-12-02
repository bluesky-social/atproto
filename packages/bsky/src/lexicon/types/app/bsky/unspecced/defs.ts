/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'app.bsky.unspecced.defs'

export interface SkeletonSearchPost {
  $type?: $Type<'app.bsky.unspecced.defs', 'skeletonSearchPost'>
  uri: string
}

export function isSkeletonSearchPost<V>(v: V) {
  return is$typed(v, id, 'skeletonSearchPost')
}

export function validateSkeletonSearchPost(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonSearchPost`,
    v,
  ) as ValidationResult<SkeletonSearchPost>
}

export function isValidSkeletonSearchPost<V>(
  v: V,
): v is V & $Typed<SkeletonSearchPost> {
  return isSkeletonSearchPost(v) && validateSkeletonSearchPost(v).success
}

export interface SkeletonSearchActor {
  $type?: $Type<'app.bsky.unspecced.defs', 'skeletonSearchActor'>
  did: string
}

export function isSkeletonSearchActor<V>(v: V) {
  return is$typed(v, id, 'skeletonSearchActor')
}

export function validateSkeletonSearchActor(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonSearchActor`,
    v,
  ) as ValidationResult<SkeletonSearchActor>
}

export function isValidSkeletonSearchActor<V>(
  v: V,
): v is V & $Typed<SkeletonSearchActor> {
  return isSkeletonSearchActor(v) && validateSkeletonSearchActor(v).success
}

export interface SkeletonSearchStarterPack {
  $type?: $Type<'app.bsky.unspecced.defs', 'skeletonSearchStarterPack'>
  uri: string
}

export function isSkeletonSearchStarterPack<V>(v: V) {
  return is$typed(v, id, 'skeletonSearchStarterPack')
}

export function validateSkeletonSearchStarterPack(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonSearchStarterPack`,
    v,
  ) as ValidationResult<SkeletonSearchStarterPack>
}

export function isValidSkeletonSearchStarterPack<V>(
  v: V,
): v is V & $Typed<SkeletonSearchStarterPack> {
  return (
    isSkeletonSearchStarterPack(v) &&
    validateSkeletonSearchStarterPack(v).success
  )
}

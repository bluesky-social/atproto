/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.unspecced.defs'

export interface SkeletonSearchPost {
  $type?: $Type<'app.bsky.unspecced.defs', 'skeletonSearchPost'>
  uri: string
}

const hashSkeletonSearchPost = 'skeletonSearchPost'

export function isSkeletonSearchPost<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchPost)
}

export function validateSkeletonSearchPost<V>(v: V) {
  return validate<SkeletonSearchPost & V>(v, id, hashSkeletonSearchPost)
}

export function isValidSkeletonSearchPost<V>(v: V) {
  return isValid<SkeletonSearchPost>(v, id, hashSkeletonSearchPost)
}

export interface SkeletonSearchActor {
  $type?: $Type<'app.bsky.unspecced.defs', 'skeletonSearchActor'>
  did: string
}

const hashSkeletonSearchActor = 'skeletonSearchActor'

export function isSkeletonSearchActor<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchActor)
}

export function validateSkeletonSearchActor<V>(v: V) {
  return validate<SkeletonSearchActor & V>(v, id, hashSkeletonSearchActor)
}

export function isValidSkeletonSearchActor<V>(v: V) {
  return isValid<SkeletonSearchActor>(v, id, hashSkeletonSearchActor)
}

export interface SkeletonSearchStarterPack {
  $type?: $Type<'app.bsky.unspecced.defs', 'skeletonSearchStarterPack'>
  uri: string
}

const hashSkeletonSearchStarterPack = 'skeletonSearchStarterPack'

export function isSkeletonSearchStarterPack<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchStarterPack)
}

export function validateSkeletonSearchStarterPack<V>(v: V) {
  return validate<SkeletonSearchStarterPack & V>(
    v,
    id,
    hashSkeletonSearchStarterPack,
  )
}

export function isValidSkeletonSearchStarterPack<V>(v: V) {
  return isValid<SkeletonSearchStarterPack>(
    v,
    id,
    hashSkeletonSearchStarterPack,
  )
}

export interface TrendingTopic {
  $type?: $Type<'app.bsky.unspecced.defs', 'trendingTopic'>
  topic: string
  displayName?: string
  description?: string
  link: string
}

const hashTrendingTopic = 'trendingTopic'

export function isTrendingTopic<V>(v: V) {
  return is$typed(v, id, hashTrendingTopic)
}

export function validateTrendingTopic<V>(v: V) {
  return validate<TrendingTopic & V>(v, id, hashTrendingTopic)
}

export function isValidTrendingTopic<V>(v: V) {
  return isValid<TrendingTopic>(v, id, hashTrendingTopic)
}

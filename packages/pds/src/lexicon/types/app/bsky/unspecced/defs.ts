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
const id = 'app.bsky.unspecced.defs'

export interface SkeletonSearchPost {
  $type?: 'app.bsky.unspecced.defs#skeletonSearchPost'
  uri: string
}

const hashSkeletonSearchPost = 'skeletonSearchPost'

export function isSkeletonSearchPost<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchPost)
}

export function validateSkeletonSearchPost<V>(v: V) {
  return validate<SkeletonSearchPost & V>(v, id, hashSkeletonSearchPost)
}

export interface SkeletonSearchActor {
  $type?: 'app.bsky.unspecced.defs#skeletonSearchActor'
  did: string
}

const hashSkeletonSearchActor = 'skeletonSearchActor'

export function isSkeletonSearchActor<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchActor)
}

export function validateSkeletonSearchActor<V>(v: V) {
  return validate<SkeletonSearchActor & V>(v, id, hashSkeletonSearchActor)
}

export interface SkeletonSearchStarterPack {
  $type?: 'app.bsky.unspecced.defs#skeletonSearchStarterPack'
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

export interface TrendingTopic {
  $type?: 'app.bsky.unspecced.defs#trendingTopic'
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

export interface Trend {
  $type?: 'app.bsky.unspecced.defs#trend'
  topic: string
  displayName: string
  link: string
  startTime: string
  postCount: number
  actors: AppBskyActorDefs.ProfileViewBasic[]
}

const hashTrend = 'trend'

export function isTrend<V>(v: V) {
  return is$typed(v, id, hashTrend)
}

export function validateTrend<V>(v: V) {
  return validate<Trend & V>(v, id, hashTrend)
}

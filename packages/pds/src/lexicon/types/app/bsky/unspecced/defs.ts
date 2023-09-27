/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface SkeletonSearchPost {
  uri: string
  [k: string]: unknown
}

export function isSkeletonSearchPost(v: unknown): v is SkeletonSearchPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.unspecced.defs#skeletonSearchPost'
  )
}

export function validateSkeletonSearchPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.unspecced.defs#skeletonSearchPost', v)
}

export interface SkeletonSearchActor {
  did: string
  [k: string]: unknown
}

export function isSkeletonSearchActor(v: unknown): v is SkeletonSearchActor {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.unspecced.defs#skeletonSearchActor'
  )
}

export function validateSkeletonSearchActor(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.unspecced.defs#skeletonSearchActor', v)
}

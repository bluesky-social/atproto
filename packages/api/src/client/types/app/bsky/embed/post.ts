/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as AppBskyActorRef from '../actor/ref'

export interface Main {
  post: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.embed.post#main' ||
      v.$type === 'app.bsky.embed.post')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.post#main', v)
}

export interface Presented {
  post:
    | PresentedPost
    | PresentedNotFound
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isPresented(v: unknown): v is Presented {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.post#presented'
  )
}

export function validatePresented(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.post#presented', v)
}

export interface PresentedPost {
  uri: string
  cid: string
  author: AppBskyActorRef.WithInfo
  record: {}
  [k: string]: unknown
}

export function isPresentedPost(v: unknown): v is PresentedPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.post#presentedPost'
  )
}

export function validatePresentedPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.post#presentedPost', v)
}

export interface PresentedNotFound {
  uri: string
  [k: string]: unknown
}

export function isPresentedNotFound(v: unknown): v is PresentedNotFound {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.post#presentedNotFound'
  )
}

export function validatePresentedNotFound(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.post#presentedNotFound', v)
}

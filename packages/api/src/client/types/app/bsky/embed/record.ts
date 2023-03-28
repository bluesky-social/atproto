/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyEmbedImages from './images'
import * as AppBskyEmbedExternal from './external'
import * as AppBskyEmbedRecordWithMedia from './recordWithMedia'

export interface Main {
  record: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.embed.record#main' ||
      v.$type === 'app.bsky.embed.record')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.record#main', v)
}

export interface View {
  record: ViewRecord | ViewNotFound | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.embed.record#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.record#view', v)
}

export interface ViewRecord {
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  value: {}
  embeds?: (
    | AppBskyEmbedImages.View
    | AppBskyEmbedExternal.View
    | View
    | AppBskyEmbedRecordWithMedia.View
    | { $type: string; [k: string]: unknown }
  )[]
  indexedAt: string
  [k: string]: unknown
}

export function isViewRecord(v: unknown): v is ViewRecord {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.record#viewRecord'
  )
}

export function validateViewRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.record#viewRecord', v)
}

export interface ViewNotFound {
  uri: string
  [k: string]: unknown
}

export function isViewNotFound(v: unknown): v is ViewNotFound {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.record#viewNotFound'
  )
}

export function validateViewNotFound(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.record#viewNotFound', v)
}

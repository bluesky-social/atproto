/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as AppBskyFeedDefs from '../feed/defs'
import * as AppBskyGraphDefs from '../graph/defs'
import * as AppBskyLabelerDefs from '../labeler/defs'
import * as AppBskyActorDefs from '../actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyEmbedImages from './images'
import * as AppBskyEmbedVideo from './video'
import * as AppBskyEmbedExternal from './external'
import * as AppBskyEmbedRecordWithMedia from './recordWithMedia'

const id = 'app.bsky.embed.record'

export interface Main {
  record: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isMain(
  v: unknown,
): v is Main & { $type: $Type<'app.bsky.embed.record', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export interface View {
  record:
    | ViewRecord
    | ViewNotFound
    | ViewBlocked
    | ViewDetached
    | AppBskyFeedDefs.GeneratorView
    | AppBskyGraphDefs.ListView
    | AppBskyLabelerDefs.LabelerView
    | AppBskyGraphDefs.StarterPackViewBasic
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isView(
  v: unknown,
): v is View & { $type: $Type<'app.bsky.embed.record', 'view'> } {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}

export interface ViewRecord {
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  /** The record data itself. */
  value: {}
  labels?: ComAtprotoLabelDefs.Label[]
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  embeds?: (
    | AppBskyEmbedImages.View
    | AppBskyEmbedVideo.View
    | AppBskyEmbedExternal.View
    | View
    | AppBskyEmbedRecordWithMedia.View
    | { $type: string; [k: string]: unknown }
  )[]
  indexedAt: string
  [k: string]: unknown
}

export function isViewRecord(
  v: unknown,
): v is ViewRecord & { $type: $Type<'app.bsky.embed.record', 'viewRecord'> } {
  return is$typed(v, id, 'viewRecord')
}

export function validateViewRecord(v: unknown) {
  return lexicons.validate(
    `${id}#viewRecord`,
    v,
  ) as ValidationResult<ViewRecord>
}

export interface ViewNotFound {
  uri: string
  notFound: true
  [k: string]: unknown
}

export function isViewNotFound(v: unknown): v is ViewNotFound & {
  $type: $Type<'app.bsky.embed.record', 'viewNotFound'>
} {
  return is$typed(v, id, 'viewNotFound')
}

export function validateViewNotFound(v: unknown) {
  return lexicons.validate(
    `${id}#viewNotFound`,
    v,
  ) as ValidationResult<ViewNotFound>
}

export interface ViewBlocked {
  uri: string
  blocked: true
  author: AppBskyFeedDefs.BlockedAuthor
  [k: string]: unknown
}

export function isViewBlocked(
  v: unknown,
): v is ViewBlocked & { $type: $Type<'app.bsky.embed.record', 'viewBlocked'> } {
  return is$typed(v, id, 'viewBlocked')
}

export function validateViewBlocked(v: unknown) {
  return lexicons.validate(
    `${id}#viewBlocked`,
    v,
  ) as ValidationResult<ViewBlocked>
}

export interface ViewDetached {
  uri: string
  detached: true
  [k: string]: unknown
}

export function isViewDetached(v: unknown): v is ViewDetached & {
  $type: $Type<'app.bsky.embed.record', 'viewDetached'>
} {
  return is$typed(v, id, 'viewDetached')
}

export function validateViewDetached(v: unknown) {
  return lexicons.validate(
    `${id}#viewDetached`,
    v,
  ) as ValidationResult<ViewDetached>
}

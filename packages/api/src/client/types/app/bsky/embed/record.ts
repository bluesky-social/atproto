/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
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

export const id = 'app.bsky.embed.record'

export interface Main {
  $type?: $Type<'app.bsky.embed.record', 'main'>
  record: ComAtprotoRepoStrongRef.Main
}

export function isMain<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export function isValidMain<V>(v: V): v is V & $Typed<Main> {
  return isMain(v) && validateMain(v).success
}

export interface View {
  $type?: $Type<'app.bsky.embed.record', 'view'>
  record:
    | $Typed<ViewRecord>
    | $Typed<ViewNotFound>
    | $Typed<ViewBlocked>
    | $Typed<ViewDetached>
    | $Typed<AppBskyFeedDefs.GeneratorView>
    | $Typed<AppBskyGraphDefs.ListView>
    | $Typed<AppBskyLabelerDefs.LabelerView>
    | $Typed<AppBskyGraphDefs.StarterPackViewBasic>
    | { $type: string }
}

export function isView<V>(v: V) {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}

export function isValidView<V>(v: V): v is V & $Typed<View> {
  return isView(v) && validateView(v).success
}

export interface ViewRecord {
  $type?: $Type<'app.bsky.embed.record', 'viewRecord'>
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  /** The record data itself. */
  value: { [_ in string]: unknown }
  labels?: ComAtprotoLabelDefs.Label[]
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  embeds?: (
    | $Typed<AppBskyEmbedImages.View>
    | $Typed<AppBskyEmbedVideo.View>
    | $Typed<AppBskyEmbedExternal.View>
    | $Typed<View>
    | $Typed<AppBskyEmbedRecordWithMedia.View>
    | { $type: string }
  )[]
  indexedAt: string
}

export function isViewRecord<V>(v: V) {
  return is$typed(v, id, 'viewRecord')
}

export function validateViewRecord(v: unknown) {
  return lexicons.validate(
    `${id}#viewRecord`,
    v,
  ) as ValidationResult<ViewRecord>
}

export function isValidViewRecord<V>(v: V): v is V & $Typed<ViewRecord> {
  return isViewRecord(v) && validateViewRecord(v).success
}

export interface ViewNotFound {
  $type?: $Type<'app.bsky.embed.record', 'viewNotFound'>
  uri: string
  notFound: true
}

export function isViewNotFound<V>(v: V) {
  return is$typed(v, id, 'viewNotFound')
}

export function validateViewNotFound(v: unknown) {
  return lexicons.validate(
    `${id}#viewNotFound`,
    v,
  ) as ValidationResult<ViewNotFound>
}

export function isValidViewNotFound<V>(v: V): v is V & $Typed<ViewNotFound> {
  return isViewNotFound(v) && validateViewNotFound(v).success
}

export interface ViewBlocked {
  $type?: $Type<'app.bsky.embed.record', 'viewBlocked'>
  uri: string
  blocked: true
  author: AppBskyFeedDefs.BlockedAuthor
}

export function isViewBlocked<V>(v: V) {
  return is$typed(v, id, 'viewBlocked')
}

export function validateViewBlocked(v: unknown) {
  return lexicons.validate(
    `${id}#viewBlocked`,
    v,
  ) as ValidationResult<ViewBlocked>
}

export function isValidViewBlocked<V>(v: V): v is V & $Typed<ViewBlocked> {
  return isViewBlocked(v) && validateViewBlocked(v).success
}

export interface ViewDetached {
  $type?: $Type<'app.bsky.embed.record', 'viewDetached'>
  uri: string
  detached: true
}

export function isViewDetached<V>(v: V) {
  return is$typed(v, id, 'viewDetached')
}

export function validateViewDetached(v: unknown) {
  return lexicons.validate(
    `${id}#viewDetached`,
    v,
  ) as ValidationResult<ViewDetached>
}

export function isValidViewDetached<V>(v: V): v is V & $Typed<ViewDetached> {
  return isViewDetached(v) && validateViewDetached(v).success
}

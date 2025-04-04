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
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'
import type * as AppBskyActorDefs from '../actor/defs.js'
import type * as AppBskyRichtextFacet from '../richtext/facet.js'
import type * as AppBskyFeedDefs from '../feed/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.graph.defs'

export interface ListViewBasic {
  $type?: 'app.bsky.graph.defs#listViewBasic'
  uri: string
  cid: string
  name: string
  purpose: ListPurpose
  avatar?: string
  listItemCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  viewer?: ListViewerState
  indexedAt?: string
}

const hashListViewBasic = 'listViewBasic'

export function isListViewBasic<V>(v: V) {
  return is$typed(v, id, hashListViewBasic)
}

export function validateListViewBasic<V>(v: V) {
  return validate<ListViewBasic & V>(v, id, hashListViewBasic)
}

export interface ListView {
  $type?: 'app.bsky.graph.defs#listView'
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  name: string
  purpose: ListPurpose
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: string
  listItemCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  viewer?: ListViewerState
  indexedAt: string
}

const hashListView = 'listView'

export function isListView<V>(v: V) {
  return is$typed(v, id, hashListView)
}

export function validateListView<V>(v: V) {
  return validate<ListView & V>(v, id, hashListView)
}

export interface ListItemView {
  $type?: 'app.bsky.graph.defs#listItemView'
  uri: string
  subject: AppBskyActorDefs.ProfileView
}

const hashListItemView = 'listItemView'

export function isListItemView<V>(v: V) {
  return is$typed(v, id, hashListItemView)
}

export function validateListItemView<V>(v: V) {
  return validate<ListItemView & V>(v, id, hashListItemView)
}

export interface StarterPackView {
  $type?: 'app.bsky.graph.defs#starterPackView'
  uri: string
  cid: string
  record: { [_ in string]: unknown }
  creator: AppBskyActorDefs.ProfileViewBasic
  list?: ListViewBasic
  listItemsSample?: ListItemView[]
  feeds?: AppBskyFeedDefs.GeneratorView[]
  joinedWeekCount?: number
  joinedAllTimeCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
}

const hashStarterPackView = 'starterPackView'

export function isStarterPackView<V>(v: V) {
  return is$typed(v, id, hashStarterPackView)
}

export function validateStarterPackView<V>(v: V) {
  return validate<StarterPackView & V>(v, id, hashStarterPackView)
}

export interface StarterPackViewBasic {
  $type?: 'app.bsky.graph.defs#starterPackViewBasic'
  uri: string
  cid: string
  record: { [_ in string]: unknown }
  creator: AppBskyActorDefs.ProfileViewBasic
  listItemCount?: number
  joinedWeekCount?: number
  joinedAllTimeCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
}

const hashStarterPackViewBasic = 'starterPackViewBasic'

export function isStarterPackViewBasic<V>(v: V) {
  return is$typed(v, id, hashStarterPackViewBasic)
}

export function validateStarterPackViewBasic<V>(v: V) {
  return validate<StarterPackViewBasic & V>(v, id, hashStarterPackViewBasic)
}

export type ListPurpose =
  | 'app.bsky.graph.defs#modlist'
  | 'app.bsky.graph.defs#curatelist'
  | 'app.bsky.graph.defs#referencelist'
  | (string & {})

/** A list of actors to apply an aggregate moderation action (mute/block) on. */
export const MODLIST = `${id}#modlist`
/** A list of actors used for curation purposes such as list feeds or interaction gating. */
export const CURATELIST = `${id}#curatelist`
/** A list of actors used for only for reference purposes such as within a starter pack. */
export const REFERENCELIST = `${id}#referencelist`

export interface ListViewerState {
  $type?: 'app.bsky.graph.defs#listViewerState'
  muted?: boolean
  blocked?: string
}

const hashListViewerState = 'listViewerState'

export function isListViewerState<V>(v: V) {
  return is$typed(v, id, hashListViewerState)
}

export function validateListViewerState<V>(v: V) {
  return validate<ListViewerState & V>(v, id, hashListViewerState)
}

/** indicates that a handle or DID could not be resolved */
export interface NotFoundActor {
  $type?: 'app.bsky.graph.defs#notFoundActor'
  actor: string
  notFound: true
}

const hashNotFoundActor = 'notFoundActor'

export function isNotFoundActor<V>(v: V) {
  return is$typed(v, id, hashNotFoundActor)
}

export function validateNotFoundActor<V>(v: V) {
  return validate<NotFoundActor & V>(v, id, hashNotFoundActor)
}

/** lists the bi-directional graph relationships between one actor (not indicated in the object), and the target actors (the DID included in the object) */
export interface Relationship {
  $type?: 'app.bsky.graph.defs#relationship'
  did: string
  /** if the actor follows this DID, this is the AT-URI of the follow record */
  following?: string
  /** if the actor is followed by this DID, contains the AT-URI of the follow record */
  followedBy?: string
}

const hashRelationship = 'relationship'

export function isRelationship<V>(v: V) {
  return is$typed(v, id, hashRelationship)
}

export function validateRelationship<V>(v: V) {
  return validate<Relationship & V>(v, id, hashRelationship)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyFeedDefs from '../feed/defs'

export const id = 'app.bsky.graph.defs'

export interface ListViewBasic {
  $type?: $Type<'app.bsky.graph.defs', 'listViewBasic'>
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

export function isListViewBasic<V>(v: V) {
  return is$typed(v, id, 'listViewBasic')
}

export function validateListViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#listViewBasic`,
    v,
  ) as ValidationResult<ListViewBasic>
}

export function isValidListViewBasic<V>(v: V): v is V & $Typed<ListViewBasic> {
  return isListViewBasic(v) && validateListViewBasic(v).success
}

export interface ListView {
  $type?: $Type<'app.bsky.graph.defs', 'listView'>
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

export function isListView<V>(v: V) {
  return is$typed(v, id, 'listView')
}

export function validateListView(v: unknown) {
  return lexicons.validate(`${id}#listView`, v) as ValidationResult<ListView>
}

export function isValidListView<V>(v: V): v is V & $Typed<ListView> {
  return isListView(v) && validateListView(v).success
}

export interface ListItemView {
  $type?: $Type<'app.bsky.graph.defs', 'listItemView'>
  uri: string
  subject: AppBskyActorDefs.ProfileView
}

export function isListItemView<V>(v: V) {
  return is$typed(v, id, 'listItemView')
}

export function validateListItemView(v: unknown) {
  return lexicons.validate(
    `${id}#listItemView`,
    v,
  ) as ValidationResult<ListItemView>
}

export function isValidListItemView<V>(v: V): v is V & $Typed<ListItemView> {
  return isListItemView(v) && validateListItemView(v).success
}

export interface StarterPackView {
  $type?: $Type<'app.bsky.graph.defs', 'starterPackView'>
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

export function isStarterPackView<V>(v: V) {
  return is$typed(v, id, 'starterPackView')
}

export function validateStarterPackView(v: unknown) {
  return lexicons.validate(
    `${id}#starterPackView`,
    v,
  ) as ValidationResult<StarterPackView>
}

export function isValidStarterPackView<V>(
  v: V,
): v is V & $Typed<StarterPackView> {
  return isStarterPackView(v) && validateStarterPackView(v).success
}

export interface StarterPackViewBasic {
  $type?: $Type<'app.bsky.graph.defs', 'starterPackViewBasic'>
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

export function isStarterPackViewBasic<V>(v: V) {
  return is$typed(v, id, 'starterPackViewBasic')
}

export function validateStarterPackViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#starterPackViewBasic`,
    v,
  ) as ValidationResult<StarterPackViewBasic>
}

export function isValidStarterPackViewBasic<V>(
  v: V,
): v is V & $Typed<StarterPackViewBasic> {
  return isStarterPackViewBasic(v) && validateStarterPackViewBasic(v).success
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
  $type?: $Type<'app.bsky.graph.defs', 'listViewerState'>
  muted?: boolean
  blocked?: string
}

export function isListViewerState<V>(v: V) {
  return is$typed(v, id, 'listViewerState')
}

export function validateListViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#listViewerState`,
    v,
  ) as ValidationResult<ListViewerState>
}

export function isValidListViewerState<V>(
  v: V,
): v is V & $Typed<ListViewerState> {
  return isListViewerState(v) && validateListViewerState(v).success
}

/** indicates that a handle or DID could not be resolved */
export interface NotFoundActor {
  $type?: $Type<'app.bsky.graph.defs', 'notFoundActor'>
  actor: string
  notFound: true
}

export function isNotFoundActor<V>(v: V) {
  return is$typed(v, id, 'notFoundActor')
}

export function validateNotFoundActor(v: unknown) {
  return lexicons.validate(
    `${id}#notFoundActor`,
    v,
  ) as ValidationResult<NotFoundActor>
}

export function isValidNotFoundActor<V>(v: V): v is V & $Typed<NotFoundActor> {
  return isNotFoundActor(v) && validateNotFoundActor(v).success
}

/** lists the bi-directional graph relationships between one actor (not indicated in the object), and the target actors (the DID included in the object) */
export interface Relationship {
  $type?: $Type<'app.bsky.graph.defs', 'relationship'>
  did: string
  /** if the actor follows this DID, this is the AT-URI of the follow record */
  following?: string
  /** if the actor is followed by this DID, contains the AT-URI of the follow record */
  followedBy?: string
}

export function isRelationship<V>(v: V) {
  return is$typed(v, id, 'relationship')
}

export function validateRelationship(v: unknown) {
  return lexicons.validate(
    `${id}#relationship`,
    v,
  ) as ValidationResult<Relationship>
}

export function isValidRelationship<V>(v: V): v is V & $Typed<Relationship> {
  return isRelationship(v) && validateRelationship(v).success
}

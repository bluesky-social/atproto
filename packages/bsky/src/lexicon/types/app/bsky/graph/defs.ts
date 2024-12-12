/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyFeedDefs from '../feed/defs'

const id = 'app.bsky.graph.defs'

export interface ListViewBasic {
  uri: string
  cid: string
  name: string
  purpose: ListPurpose
  avatar?: string
  listItemCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  viewer?: ListViewerState
  indexedAt?: string
  [k: string]: unknown
}

export function isListViewBasic(v: unknown): v is ListViewBasic & {
  $type: $Type<'app.bsky.graph.defs', 'listViewBasic'>
} {
  return is$typed(v, id, 'listViewBasic')
}

export function validateListViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#listViewBasic`,
    v,
  ) as ValidationResult<ListViewBasic>
}

export interface ListView {
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
  [k: string]: unknown
}

export function isListView(
  v: unknown,
): v is ListView & { $type: $Type<'app.bsky.graph.defs', 'listView'> } {
  return is$typed(v, id, 'listView')
}

export function validateListView(v: unknown) {
  return lexicons.validate(`${id}#listView`, v) as ValidationResult<ListView>
}

export interface ListItemView {
  uri: string
  subject: AppBskyActorDefs.ProfileView
  [k: string]: unknown
}

export function isListItemView(
  v: unknown,
): v is ListItemView & { $type: $Type<'app.bsky.graph.defs', 'listItemView'> } {
  return is$typed(v, id, 'listItemView')
}

export function validateListItemView(v: unknown) {
  return lexicons.validate(
    `${id}#listItemView`,
    v,
  ) as ValidationResult<ListItemView>
}

export interface StarterPackView {
  uri: string
  cid: string
  record: {}
  creator: AppBskyActorDefs.ProfileViewBasic
  list?: ListViewBasic
  listItemsSample?: ListItemView[]
  feeds?: AppBskyFeedDefs.GeneratorView[]
  joinedWeekCount?: number
  joinedAllTimeCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
  [k: string]: unknown
}

export function isStarterPackView(v: unknown): v is StarterPackView & {
  $type: $Type<'app.bsky.graph.defs', 'starterPackView'>
} {
  return is$typed(v, id, 'starterPackView')
}

export function validateStarterPackView(v: unknown) {
  return lexicons.validate(
    `${id}#starterPackView`,
    v,
  ) as ValidationResult<StarterPackView>
}

export interface StarterPackViewBasic {
  uri: string
  cid: string
  record: {}
  creator: AppBskyActorDefs.ProfileViewBasic
  listItemCount?: number
  joinedWeekCount?: number
  joinedAllTimeCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
  [k: string]: unknown
}

export function isStarterPackViewBasic(
  v: unknown,
): v is StarterPackViewBasic & {
  $type: $Type<'app.bsky.graph.defs', 'starterPackViewBasic'>
} {
  return is$typed(v, id, 'starterPackViewBasic')
}

export function validateStarterPackViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#starterPackViewBasic`,
    v,
  ) as ValidationResult<StarterPackViewBasic>
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
  muted?: boolean
  blocked?: string
  [k: string]: unknown
}

export function isListViewerState(v: unknown): v is ListViewerState & {
  $type: $Type<'app.bsky.graph.defs', 'listViewerState'>
} {
  return is$typed(v, id, 'listViewerState')
}

export function validateListViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#listViewerState`,
    v,
  ) as ValidationResult<ListViewerState>
}

/** indicates that a handle or DID could not be resolved */
export interface NotFoundActor {
  actor: string
  notFound: true
  [k: string]: unknown
}

export function isNotFoundActor(v: unknown): v is NotFoundActor & {
  $type: $Type<'app.bsky.graph.defs', 'notFoundActor'>
} {
  return is$typed(v, id, 'notFoundActor')
}

export function validateNotFoundActor(v: unknown) {
  return lexicons.validate(
    `${id}#notFoundActor`,
    v,
  ) as ValidationResult<NotFoundActor>
}

/** lists the bi-directional graph relationships between one actor (not indicated in the object), and the target actors (the DID included in the object) */
export interface Relationship {
  did: string
  /** if the actor follows this DID, this is the AT-URI of the follow record */
  following?: string
  /** if the actor is followed by this DID, contains the AT-URI of the follow record */
  followedBy?: string
  [k: string]: unknown
}

export function isRelationship(
  v: unknown,
): v is Relationship & { $type: $Type<'app.bsky.graph.defs', 'relationship'> } {
  return is$typed(v, id, 'relationship')
}

export function validateRelationship(v: unknown) {
  return lexicons.validate(
    `${id}#relationship`,
    v,
  ) as ValidationResult<Relationship>
}

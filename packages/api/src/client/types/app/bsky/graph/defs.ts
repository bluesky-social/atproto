/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyFeedDefs from '../feed/defs'

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

export function isListViewBasic(v: unknown): v is ListViewBasic {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#listViewBasic'
  )
}

export function validateListViewBasic(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#listViewBasic', v)
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

export function isListView(v: unknown): v is ListView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#listView'
  )
}

export function validateListView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#listView', v)
}

export interface ListItemView {
  uri: string
  subject: AppBskyActorDefs.ProfileView
  [k: string]: unknown
}

export function isListItemView(v: unknown): v is ListItemView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#listItemView'
  )
}

export function validateListItemView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#listItemView', v)
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

export function isStarterPackView(v: unknown): v is StarterPackView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#starterPackView'
  )
}

export function validateStarterPackView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#starterPackView', v)
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

export function isStarterPackViewBasic(v: unknown): v is StarterPackViewBasic {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#starterPackViewBasic'
  )
}

export function validateStarterPackViewBasic(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#starterPackViewBasic', v)
}

export type ListPurpose =
  | 'app.bsky.graph.defs#modlist'
  | 'app.bsky.graph.defs#curatelist'
  | 'app.bsky.graph.defs#referencelist'
  | (string & {})

/** A list of actors to apply an aggregate moderation action (mute/block) on. */
export const MODLIST = 'app.bsky.graph.defs#modlist'
/** A list of actors used for curation purposes such as list feeds or interaction gating. */
export const CURATELIST = 'app.bsky.graph.defs#curatelist'
/** A list of actors used for only for reference purposes such as within a starter pack. */
export const REFERENCELIST = 'app.bsky.graph.defs#referencelist'

export interface ListViewerState {
  muted?: boolean
  blocked?: string
  [k: string]: unknown
}

export function isListViewerState(v: unknown): v is ListViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#listViewerState'
  )
}

export function validateListViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#listViewerState', v)
}

/** indicates that a handle or DID could not be resolved */
export interface NotFoundActor {
  actor: string
  notFound: true
  [k: string]: unknown
}

export function isNotFoundActor(v: unknown): v is NotFoundActor {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#notFoundActor'
  )
}

export function validateNotFoundActor(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#notFoundActor', v)
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

export function isRelationship(v: unknown): v is Relationship {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.defs#relationship'
  )
}

export function validateRelationship(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.defs#relationship', v)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'

export interface ListViewBasic {
  uri: string
  cid: string
  name: string
  purpose: ListPurpose
  avatar?: string
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

export type ListPurpose =
  | 'app.bsky.graph.defs#modlist'
  | 'app.bsky.graph.defs#curatelist'
  | (string & {})

/** A list of actors to apply an aggregate moderation action (mute/block) on */
export const MODLIST = 'app.bsky.graph.defs#modlist'
/** A list of actors used for curation purposes such as list feeds or interaction gating */
export const CURATELIST = 'app.bsky.graph.defs#curatelist'

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

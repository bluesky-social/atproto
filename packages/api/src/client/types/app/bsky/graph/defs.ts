/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyActorDefs from '../actor/defs'

export interface ListView {
  name: string
  purpose: ListPurpose
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: string
  viewer?: ListViewerState
  indexedAt?: string
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
  reason?: string
  reasonFacets?: AppBskyRichtextFacet.Main[]
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

export type ListPurpose = 'app.bsky.graph.defs#blocklist' | (string & {})

/** A list of actors to do an aggregate block on */
export const BLOCKLIST = 'app.bsky.graph.defs#blocklist'

export interface ListViewerState {
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

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export interface LabelerView {
  uri: string
  cid: string
  did: string
  creator: AppBskyActorDefs.ProfileView
  displayName: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: string
  likeCount?: number
  viewer?: LabelerViewerState
  indexedAt: string
  [k: string]: unknown
}

export function isLabelerView(v: unknown): v is LabelerView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.mod.defs#labelerView'
  )
}

export function validateLabelerView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.mod.defs#labelerView', v)
}

export interface LabelerViewDetailed {
  uri: string
  cid: string
  did: string
  creator: AppBskyActorDefs.ProfileView
  displayName: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: string
  policies?: LabelerPolicies
  likeCount?: number
  viewer?: LabelerViewerState
  indexedAt: string
  [k: string]: unknown
}

export function isLabelerViewDetailed(v: unknown): v is LabelerViewDetailed {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.mod.defs#labelerViewDetailed'
  )
}

export function validateLabelerViewDetailed(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.mod.defs#labelerViewDetailed', v)
}

export interface LabelerViewerState {
  like?: string
  [k: string]: unknown
}

export function isLabelerViewerState(v: unknown): v is LabelerViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.mod.defs#labelerViewerState'
  )
}

export function validateLabelerViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.mod.defs#labelerViewerState', v)
}

export interface LabelerPolicies {
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  reportReasons: ComAtprotoModerationDefs.ReasonType[]
  labelValues: ComAtprotoLabelDefs.LabelValue[]
  [k: string]: unknown
}

export function isLabelerPolicies(v: unknown): v is LabelerPolicies {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.mod.defs#labelerPolicies'
  )
}

export function validateLabelerPolicies(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.mod.defs#labelerPolicies', v)
}

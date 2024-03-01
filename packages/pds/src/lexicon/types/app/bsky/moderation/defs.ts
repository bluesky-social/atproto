/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export interface ModServiceView {
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  likeCount?: number
  viewer?: ModServiceViewerState
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isModServiceView(v: unknown): v is ModServiceView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.moderation.defs#modServiceView'
  )
}

export function validateModServiceView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.moderation.defs#modServiceView', v)
}

export interface ModServiceViewDetailed {
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  policies: ModServicePolicies
  likeCount?: number
  viewer?: ModServiceViewerState
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isModServiceViewDetailed(
  v: unknown,
): v is ModServiceViewDetailed {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.moderation.defs#modServiceViewDetailed'
  )
}

export function validateModServiceViewDetailed(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.moderation.defs#modServiceViewDetailed', v)
}

export interface ModServiceViewerState {
  like?: string
  [k: string]: unknown
}

export function isModServiceViewerState(
  v: unknown,
): v is ModServiceViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.moderation.defs#modServiceViewerState'
  )
}

export function validateModServiceViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.moderation.defs#modServiceViewerState', v)
}

export interface ModServicePolicies {
  /** The label values which this labeler publishes. Be sure to prefix custom labels with 'x-'. */
  labelValues: ComAtprotoLabelDefs.LabelValue[]
  /** Label values created by this labeler and scoped exclusively to it. */
  customLabelValues?: ComAtprotoLabelDefs.LabelValueDefinition[]
  [k: string]: unknown
}

export function isModServicePolicies(v: unknown): v is ModServicePolicies {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.moderation.defs#modServicePolicies'
  )
}

export function validateModServicePolicies(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.moderation.defs#modServicePolicies', v)
}

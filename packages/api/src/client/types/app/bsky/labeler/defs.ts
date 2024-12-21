/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

const id = 'app.bsky.labeler.defs'

export interface LabelerView {
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  likeCount?: number
  viewer?: LabelerViewerState
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isLabelerView(
  v: unknown,
): v is LabelerView & { $type: $Type<'app.bsky.labeler.defs', 'labelerView'> } {
  return is$typed(v, id, 'labelerView')
}

export function validateLabelerView(v: unknown) {
  return lexicons.validate(
    `${id}#labelerView`,
    v,
  ) as ValidationResult<LabelerView>
}

export interface LabelerViewDetailed {
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  policies: LabelerPolicies
  likeCount?: number
  viewer?: LabelerViewerState
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isLabelerViewDetailed(v: unknown): v is LabelerViewDetailed & {
  $type: $Type<'app.bsky.labeler.defs', 'labelerViewDetailed'>
} {
  return is$typed(v, id, 'labelerViewDetailed')
}

export function validateLabelerViewDetailed(v: unknown) {
  return lexicons.validate(
    `${id}#labelerViewDetailed`,
    v,
  ) as ValidationResult<LabelerViewDetailed>
}

export interface LabelerViewerState {
  like?: string
  [k: string]: unknown
}

export function isLabelerViewerState(v: unknown): v is LabelerViewerState & {
  $type: $Type<'app.bsky.labeler.defs', 'labelerViewerState'>
} {
  return is$typed(v, id, 'labelerViewerState')
}

export function validateLabelerViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#labelerViewerState`,
    v,
  ) as ValidationResult<LabelerViewerState>
}

export interface LabelerPolicies {
  /** The label values which this labeler publishes. May include global or custom labels. */
  labelValues: ComAtprotoLabelDefs.LabelValue[]
  /** Label values created by this labeler and scoped exclusively to it. Labels defined here will override global label definitions for this labeler. */
  labelValueDefinitions?: ComAtprotoLabelDefs.LabelValueDefinition[]
  [k: string]: unknown
}

export function isLabelerPolicies(v: unknown): v is LabelerPolicies & {
  $type: $Type<'app.bsky.labeler.defs', 'labelerPolicies'>
} {
  return is$typed(v, id, 'labelerPolicies')
}

export function validateLabelerPolicies(v: unknown) {
  return lexicons.validate(
    `${id}#labelerPolicies`,
    v,
  ) as ValidationResult<LabelerPolicies>
}

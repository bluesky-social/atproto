/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as AppBskyActorDefs from '../actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'app.bsky.labeler.defs'

export interface LabelerView {
  $type?: $Type<'app.bsky.labeler.defs', 'labelerView'>
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  likeCount?: number
  viewer?: LabelerViewerState
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
}

export function isLabelerView<V>(v: V) {
  return is$typed(v, id, 'labelerView')
}

export function validateLabelerView(v: unknown) {
  return lexicons.validate(
    `${id}#labelerView`,
    v,
  ) as ValidationResult<LabelerView>
}

export function isValidLabelerView<V>(v: V): v is V & $Typed<LabelerView> {
  return isLabelerView(v) && validateLabelerView(v).success
}

export interface LabelerViewDetailed {
  $type?: $Type<'app.bsky.labeler.defs', 'labelerViewDetailed'>
  uri: string
  cid: string
  creator: AppBskyActorDefs.ProfileView
  policies: LabelerPolicies
  likeCount?: number
  viewer?: LabelerViewerState
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
}

export function isLabelerViewDetailed<V>(v: V) {
  return is$typed(v, id, 'labelerViewDetailed')
}

export function validateLabelerViewDetailed(v: unknown) {
  return lexicons.validate(
    `${id}#labelerViewDetailed`,
    v,
  ) as ValidationResult<LabelerViewDetailed>
}

export function isValidLabelerViewDetailed<V>(
  v: V,
): v is V & $Typed<LabelerViewDetailed> {
  return isLabelerViewDetailed(v) && validateLabelerViewDetailed(v).success
}

export interface LabelerViewerState {
  $type?: $Type<'app.bsky.labeler.defs', 'labelerViewerState'>
  like?: string
}

export function isLabelerViewerState<V>(v: V) {
  return is$typed(v, id, 'labelerViewerState')
}

export function validateLabelerViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#labelerViewerState`,
    v,
  ) as ValidationResult<LabelerViewerState>
}

export function isValidLabelerViewerState<V>(
  v: V,
): v is V & $Typed<LabelerViewerState> {
  return isLabelerViewerState(v) && validateLabelerViewerState(v).success
}

export interface LabelerPolicies {
  $type?: $Type<'app.bsky.labeler.defs', 'labelerPolicies'>
  /** The label values which this labeler publishes. May include global or custom labels. */
  labelValues: ComAtprotoLabelDefs.LabelValue[]
  /** Label values created by this labeler and scoped exclusively to it. Labels defined here will override global label definitions for this labeler. */
  labelValueDefinitions?: ComAtprotoLabelDefs.LabelValueDefinition[]
}

export function isLabelerPolicies<V>(v: V) {
  return is$typed(v, id, 'labelerPolicies')
}

export function validateLabelerPolicies(v: unknown) {
  return lexicons.validate(
    `${id}#labelerPolicies`,
    v,
  ) as ValidationResult<LabelerPolicies>
}

export function isValidLabelerPolicies<V>(
  v: V,
): v is V & $Typed<LabelerPolicies> {
  return isLabelerPolicies(v) && validateLabelerPolicies(v).success
}

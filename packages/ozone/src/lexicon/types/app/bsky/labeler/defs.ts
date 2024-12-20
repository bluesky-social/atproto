/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as AppBskyActorDefs from '../actor/defs'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.labeler.defs'

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

const hashLabelerView = 'labelerView'

export function isLabelerView<V>(v: V) {
  return is$typed(v, id, hashLabelerView)
}

export function validateLabelerView<V>(v: V) {
  return validate<LabelerView & V>(v, id, hashLabelerView)
}

export function isValidLabelerView<V>(v: V) {
  return isValid<LabelerView>(v, id, hashLabelerView)
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

const hashLabelerViewDetailed = 'labelerViewDetailed'

export function isLabelerViewDetailed<V>(v: V) {
  return is$typed(v, id, hashLabelerViewDetailed)
}

export function validateLabelerViewDetailed<V>(v: V) {
  return validate<LabelerViewDetailed & V>(v, id, hashLabelerViewDetailed)
}

export function isValidLabelerViewDetailed<V>(v: V) {
  return isValid<LabelerViewDetailed>(v, id, hashLabelerViewDetailed)
}

export interface LabelerViewerState {
  $type?: $Type<'app.bsky.labeler.defs', 'labelerViewerState'>
  like?: string
}

const hashLabelerViewerState = 'labelerViewerState'

export function isLabelerViewerState<V>(v: V) {
  return is$typed(v, id, hashLabelerViewerState)
}

export function validateLabelerViewerState<V>(v: V) {
  return validate<LabelerViewerState & V>(v, id, hashLabelerViewerState)
}

export function isValidLabelerViewerState<V>(v: V) {
  return isValid<LabelerViewerState>(v, id, hashLabelerViewerState)
}

export interface LabelerPolicies {
  $type?: $Type<'app.bsky.labeler.defs', 'labelerPolicies'>
  /** The label values which this labeler publishes. May include global or custom labels. */
  labelValues: ComAtprotoLabelDefs.LabelValue[]
  /** Label values created by this labeler and scoped exclusively to it. Labels defined here will override global label definitions for this labeler. */
  labelValueDefinitions?: ComAtprotoLabelDefs.LabelValueDefinition[]
}

const hashLabelerPolicies = 'labelerPolicies'

export function isLabelerPolicies<V>(v: V) {
  return is$typed(v, id, hashLabelerPolicies)
}

export function validateLabelerPolicies<V>(v: V) {
  return validate<LabelerPolicies & V>(v, id, hashLabelerPolicies)
}

export function isValidLabelerPolicies<V>(v: V) {
  return isValid<LabelerPolicies>(v, id, hashLabelerPolicies)
}

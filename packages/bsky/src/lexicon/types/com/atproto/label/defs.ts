/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.label.defs'

/** Metadata tag on an atproto resource (eg, repo or record). */
export interface Label {
  $type?: 'com.atproto.label.defs#label'
  /** The AT Protocol version of the label object. */
  ver?: number
  /** DID of the actor who created this label. */
  src: string
  /** AT URI of the record, repository (account), or other resource that this label applies to. */
  uri: string
  /** Optionally, CID specifying the specific version of 'uri' resource this label applies to. */
  cid?: string
  /** The short string name of the value or type of this label. */
  val: string
  /** If true, this is a negation label, overwriting a previous label. */
  neg?: boolean
  /** Timestamp when this label was created. */
  cts: string
  /** Timestamp at which this label expires (no longer applies). */
  exp?: string
  /** Signature of dag-cbor encoded label. */
  sig?: Uint8Array
}

const hashLabel = 'label'

export function isLabel<V>(v: V) {
  return is$typed(v, id, hashLabel)
}

export function validateLabel<V>(v: V) {
  return validate<Label & V>(v, id, hashLabel)
}

/** Metadata tags on an atproto record, published by the author within the record. */
export interface SelfLabels {
  $type?: 'com.atproto.label.defs#selfLabels'
  values: SelfLabel[]
}

const hashSelfLabels = 'selfLabels'

export function isSelfLabels<V>(v: V) {
  return is$typed(v, id, hashSelfLabels)
}

export function validateSelfLabels<V>(v: V) {
  return validate<SelfLabels & V>(v, id, hashSelfLabels)
}

/** Metadata tag on an atproto record, published by the author within the record. Note that schemas should use #selfLabels, not #selfLabel. */
export interface SelfLabel {
  $type?: 'com.atproto.label.defs#selfLabel'
  /** The short string name of the value or type of this label. */
  val: string
}

const hashSelfLabel = 'selfLabel'

export function isSelfLabel<V>(v: V) {
  return is$typed(v, id, hashSelfLabel)
}

export function validateSelfLabel<V>(v: V) {
  return validate<SelfLabel & V>(v, id, hashSelfLabel)
}

/** Declares a label value and its expected interpretations and behaviors. */
export interface LabelValueDefinition {
  $type?: 'com.atproto.label.defs#labelValueDefinition'
  /** The value of the label being defined. Must only include lowercase ascii and the '-' character ([a-z-]+). */
  identifier: string
  /** How should a client visually convey this label? 'inform' means neutral and informational; 'alert' means negative and warning; 'none' means show nothing. */
  severity: 'inform' | 'alert' | 'none' | (string & {})
  /** What should this label hide in the UI, if applied? 'content' hides all of the target; 'media' hides the images/video/audio; 'none' hides nothing. */
  blurs: 'content' | 'media' | 'none' | (string & {})
  /** The default setting for this label. */
  defaultSetting: 'ignore' | 'warn' | 'hide' | (string & {})
  /** Does the user need to have adult content enabled in order to configure this label? */
  adultOnly?: boolean
  locales: LabelValueDefinitionStrings[]
}

const hashLabelValueDefinition = 'labelValueDefinition'

export function isLabelValueDefinition<V>(v: V) {
  return is$typed(v, id, hashLabelValueDefinition)
}

export function validateLabelValueDefinition<V>(v: V) {
  return validate<LabelValueDefinition & V>(v, id, hashLabelValueDefinition)
}

/** Strings which describe the label in the UI, localized into a specific language. */
export interface LabelValueDefinitionStrings {
  $type?: 'com.atproto.label.defs#labelValueDefinitionStrings'
  /** The code of the language these strings are written in. */
  lang: string
  /** A short human-readable name for the label. */
  name: string
  /** A longer description of what the label means and why it might be applied. */
  description: string
}

const hashLabelValueDefinitionStrings = 'labelValueDefinitionStrings'

export function isLabelValueDefinitionStrings<V>(v: V) {
  return is$typed(v, id, hashLabelValueDefinitionStrings)
}

export function validateLabelValueDefinitionStrings<V>(v: V) {
  return validate<LabelValueDefinitionStrings & V>(
    v,
    id,
    hashLabelValueDefinitionStrings,
  )
}

export type LabelValue =
  | '!hide'
  | '!no-promote'
  | '!warn'
  | '!no-unauthenticated'
  | 'dmca-violation'
  | 'doxxing'
  | 'porn'
  | 'sexual'
  | 'nudity'
  | 'nsfl'
  | 'gore'
  | (string & {})

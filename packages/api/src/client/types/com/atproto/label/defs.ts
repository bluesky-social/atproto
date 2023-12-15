/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

/** Metadata tag on an atproto resource (eg, repo or record). */
export interface Label {
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
  [k: string]: unknown
}

export function isLabel(v: unknown): v is Label {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.label.defs#label'
  )
}

export function validateLabel(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.label.defs#label', v)
}

/** Metadata tags on an atproto record, published by the author within the record. */
export interface SelfLabels {
  values: SelfLabel[]
  [k: string]: unknown
}

export function isSelfLabels(v: unknown): v is SelfLabels {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.label.defs#selfLabels'
  )
}

export function validateSelfLabels(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.label.defs#selfLabels', v)
}

/** Metadata tag on an atproto record, published by the author within the record. Note that schemas should use #selfLabels, not #selfLabel. */
export interface SelfLabel {
  /** The short string name of the value or type of this label. */
  val: string
  [k: string]: unknown
}

export function isSelfLabel(v: unknown): v is SelfLabel {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.label.defs#selfLabel'
  )
}

export function validateSelfLabel(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.label.defs#selfLabel', v)
}

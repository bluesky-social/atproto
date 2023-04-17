/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

/** Metadata tag on an atproto resource (eg, repo or record) */
export interface Label {
  /** DID of the actor who created this label */
  src: string
  /** AT URI of the record, repository (account), or other resource which this label applies to */
  uri: string
  /** optionally, CID specifying the specific version of 'uri' resource this label applies to */
  cid?: string
  /** the short string name of the value or type of this label */
  val: string
  /** if true, this is a negation label, overwriting a previous label */
  neg?: boolean
  /** timestamp when this label was created */
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

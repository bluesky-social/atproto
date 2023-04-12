/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

/** Metadata tag on an atproto resource (eg, repo or record) */
export interface Label {}

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

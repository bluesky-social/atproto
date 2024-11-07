/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons.js'
import { isObj, hasProp } from '../../../../util.js'

export interface SigDetail {
  property: string
  value: string
  [k: string]: unknown
}

export function isSigDetail(v: unknown): v is SigDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.signature.defs#sigDetail'
  )
}

export function validateSigDetail(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.signature.defs#sigDetail', v)
}

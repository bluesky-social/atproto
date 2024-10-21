/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

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

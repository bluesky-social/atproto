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
const id = 'tools.ozone.signature.defs'

export interface SigDetail {
  $type?: 'tools.ozone.signature.defs#sigDetail'
  property: string
  value: string
}

const hashSigDetail = 'sigDetail'

export function isSigDetail<V>(v: V) {
  return is$typed(v, id, hashSigDetail)
}

export function validateSigDetail<V>(v: V) {
  return validate<SigDetail & V>(v, id, hashSigDetail)
}

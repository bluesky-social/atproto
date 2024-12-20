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

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'tools.ozone.signature.defs'

export interface SigDetail {
  $type?: $Type<'tools.ozone.signature.defs', 'sigDetail'>
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

export function isValidSigDetail<V>(v: V) {
  return isValid<SigDetail>(v, id, hashSigDetail)
}

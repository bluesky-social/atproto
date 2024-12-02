/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'tools.ozone.signature.defs'

export interface SigDetail {
  $type?: $Type<'tools.ozone.signature.defs', 'sigDetail'>
  property: string
  value: string
}

export function isSigDetail<V>(v: V) {
  return is$typed(v, id, 'sigDetail')
}

export function validateSigDetail(v: unknown) {
  return lexicons.validate(`${id}#sigDetail`, v) as ValidationResult<SigDetail>
}

export function isValidSigDetail<V>(v: V): v is V & $Typed<SigDetail> {
  return isSigDetail(v) && validateSigDetail(v).success
}

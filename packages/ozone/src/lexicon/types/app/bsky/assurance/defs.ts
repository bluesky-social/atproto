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
const id = 'app.bsky.assurance.defs'

export interface AgeAssuranceState {
  $type?: 'app.bsky.assurance.defs#ageAssuranceState'
  /** Whether the age assurance process is required for the account. If true, the user must complete age assurance process to access certain features. */
  required: boolean
  /** The status of the age assurance process. */
  status: 'unknown' | 'pending' | 'assured' | 'failed' | (string & {})
}

const hashAgeAssuranceState = 'ageAssuranceState'

export function isAgeAssuranceState<V>(v: V) {
  return is$typed(v, id, hashAgeAssuranceState)
}

export function validateAgeAssuranceState<V>(v: V) {
  return validate<AgeAssuranceState & V>(v, id, hashAgeAssuranceState)
}

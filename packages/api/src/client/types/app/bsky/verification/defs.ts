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
const id = 'app.bsky.verification.defs'

export interface AgeVerificationState {
  $type?: 'app.bsky.verification.defs#ageVerificationState'
  /** Whether the age verification process is required for the account. If true, the user must complete age verification to access certain features. */
  required: boolean
  /** The status of the age verification process. */
  status:
    | 'unverified'
    | 'pending'
    | 'verified-adult'
    | 'verified-minor'
    | 'failed'
    | (string & {})
}

const hashAgeVerificationState = 'ageVerificationState'

export function isAgeVerificationState<V>(v: V) {
  return is$typed(v, id, hashAgeVerificationState)
}

export function validateAgeVerificationState<V>(v: V) {
  return validate<AgeVerificationState & V>(v, id, hashAgeVerificationState)
}

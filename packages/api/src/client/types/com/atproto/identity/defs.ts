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
const id = 'com.atproto.identity.defs'

export interface IdentityInfo {
  $type?: 'com.atproto.identity.defs#identityInfo'
  did: string
  /** The validated handle of the account; or 'handle.invalid' if the handle did not bi-directionally match the DID document. */
  handle: string
  /** The complete DID document for the identity. */
  didDoc: { [_ in string]: unknown }
}

const hashIdentityInfo = 'identityInfo'

export function isIdentityInfo<V>(v: V) {
  return is$typed(v, id, hashIdentityInfo)
}

export function validateIdentityInfo<V>(v: V) {
  return validate<IdentityInfo & V>(v, id, hashIdentityInfo)
}

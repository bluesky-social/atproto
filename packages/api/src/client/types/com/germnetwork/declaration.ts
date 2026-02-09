/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.germnetwork.declaration'

export interface Main {
  $type: 'com.germnetwork.declaration'
  /** Semver version number, without pre-release or build information, for the format of opaque content */
  version: string
  /** Opaque value, an ed25519 public key prefixed with a byte enum */
  currentKey: Uint8Array
  messageMe?: MessageMe
  /** Opaque value, contains MLS KeyPackage(s), and other signature data, and is signed by the currentKey */
  keyPackage?: Uint8Array
  /** Array of opaque values to allow for key rolling */
  continuityProofs?: Uint8Array[]
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}

export interface MessageMe {
  $type?: 'com.germnetwork.declaration#messageMe'
  /** A URL to present to an account that does not have its own com.germnetwork.declaration record, must have an empty fragment component, where the app should fill in the fragment component with the DIDs of the two accounts who wish to message each other */
  messageMeUrl: string
  /** The policy of who can message the account, this value is included in the keyPackage, but is duplicated here to allow applications to decide if they should show a 'Message on Germ' button to the viewer. */
  showButtonTo: 'none' | 'usersIFollow' | 'everyone' | (string & {})
}

const hashMessageMe = 'messageMe'

export function isMessageMe<V>(v: V) {
  return is$typed(v, id, hashMessageMe)
}

export function validateMessageMe<V>(v: V) {
  return validate<MessageMe & V>(v, id, hashMessageMe)
}

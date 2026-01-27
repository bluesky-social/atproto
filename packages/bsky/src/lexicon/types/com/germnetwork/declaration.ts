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
  version: string
  currentKey: Uint8Array
  messageMe?: MessageMe
  keyPackage?: Uint8Array
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
  messageMeUrl: string
  showButtonTo: 'usersIFollow' | 'everyone' | (string & {})
}

const hashMessageMe = 'messageMe'

export function isMessageMe<V>(v: V) {
  return is$typed(v, id, hashMessageMe)
}

export function validateMessageMe<V>(v: V) {
  return validate<MessageMe & V>(v, id, hashMessageMe)
}

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
const id = 'app.bsky.notification.defs'

export interface RecordDeleted {
  $type?: 'app.bsky.notification.defs#recordDeleted'
}

const hashRecordDeleted = 'recordDeleted'

export function isRecordDeleted<V>(v: V) {
  return is$typed(v, id, hashRecordDeleted)
}

export function validateRecordDeleted<V>(v: V) {
  return validate<RecordDeleted & V>(v, id, hashRecordDeleted)
}

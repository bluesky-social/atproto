/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { CID } from 'multiformats/cid'
import { BlobRef, type ValidationResult } from '@atproto/lexicon'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  type OmitKey,
  is$typed as _is$typed,
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

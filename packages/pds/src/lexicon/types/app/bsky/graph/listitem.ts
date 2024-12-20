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
const id = 'app.bsky.graph.listitem'

export interface Record {
  $type?: $Type<'app.bsky.graph.listitem', 'main'>
  /** The account which is included on the list. */
  subject: string
  /** Reference (AT-URI) to the list record (app.bsky.graph.list). */
  list: string
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord)
}

export function isValidRecord<V>(v: V) {
  return isValid<Record>(v, id, hashRecord, true)
}

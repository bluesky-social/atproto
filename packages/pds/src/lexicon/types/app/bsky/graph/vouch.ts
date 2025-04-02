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
const id = 'app.bsky.graph.vouch'

export interface Record {
  $type: 'app.bsky.graph.vouch'
  /** DID of the subject the vouch applies to. */
  subject: string
  /** Handle of the subject the vouch applies to at the moment of vouching, which might not be the same at the time of viewing. The decision on how to handle this is delegated to the application. */
  handle: string
  /** Display name of the subject the vouch applies to at the moment of vouching, which might not be the same at the time of viewing. The decision on how to handle this is delegated to the application. */
  displayName: string
  /** Date of when the vouch was created. */
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

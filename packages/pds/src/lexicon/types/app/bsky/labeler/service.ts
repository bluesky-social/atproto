/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as AppBskyLabelerDefs from './defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'app.bsky.labeler.service'

export interface Record {
  $type?: $Type<'app.bsky.labeler.service', 'main'>
  policies: AppBskyLabelerDefs.LabelerPolicies
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  createdAt: string
  [k: string]: unknown
}

export function isRecord<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

export function isValidRecord<V>(v: V): v is V & $Typed<Record> {
  return isRecord(v) && validateRecord(v).success
}

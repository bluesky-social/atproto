/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'app.bsky.graph.follow'

export interface Record {
  subject: string
  createdAt: string
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'app.bsky.graph.follow', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

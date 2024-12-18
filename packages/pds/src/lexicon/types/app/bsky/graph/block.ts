/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'

const id = 'app.bsky.graph.block'

export interface Record {
  /** DID of the account to be blocked. */
  subject: string
  createdAt: string
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'app.bsky.graph.block', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

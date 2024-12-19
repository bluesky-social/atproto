/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'

const id = 'chat.bsky.actor.declaration'

export interface Record {
  allowIncoming: 'all' | 'none' | 'following' | (string & {})
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'chat.bsky.actor.declaration', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

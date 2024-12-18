/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

const id = 'app.bsky.feed.like'

export interface Record {
  subject: ComAtprotoRepoStrongRef.Main
  createdAt: string
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'app.bsky.feed.like', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

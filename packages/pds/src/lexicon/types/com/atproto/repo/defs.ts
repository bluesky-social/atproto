/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'

const id = 'com.atproto.repo.defs'

export interface CommitMeta {
  cid: string
  rev: string
  [k: string]: unknown
}

export function isCommitMeta(
  v: unknown,
): v is CommitMeta & { $type: $Type<'com.atproto.repo.defs', 'commitMeta'> } {
  return is$typed(v, id, 'commitMeta')
}

export function validateCommitMeta(v: unknown) {
  return lexicons.validate(
    `${id}#commitMeta`,
    v,
  ) as ValidationResult<CommitMeta>
}

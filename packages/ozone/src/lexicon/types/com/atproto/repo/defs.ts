/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import { $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.repo.defs'

export interface CommitMeta {
  $type?: 'com.atproto.repo.defs#commitMeta'
  cid: string
  rev: string
}

const hashCommitMeta = 'commitMeta'

export function isCommitMeta<V>(v: V) {
  return is$typed(v, id, hashCommitMeta)
}

export function validateCommitMeta<V>(v: V) {
  return validate<CommitMeta & V>(v, id, hashCommitMeta)
}

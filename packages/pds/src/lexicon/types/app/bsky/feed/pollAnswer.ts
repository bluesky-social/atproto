/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface Record {
  subject: ComAtprotoRepoStrongRef.Main
  createdAt: string
  /** The index of the option selected by the user. */
  answer: number
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.pollAnswer#main' ||
      v.$type === 'app.bsky.feed.pollAnswer')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.pollAnswer#main', v)
}

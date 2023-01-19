/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

/** A reference to a app.bsky.system.declaration record. */
export interface Main {
  cid: string
  actorType: 'app.bsky.system.actorUser' | (string & {})
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.system.declRef#main' ||
      v.$type === 'app.bsky.system.declRef')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.system.declRef#main', v)
}

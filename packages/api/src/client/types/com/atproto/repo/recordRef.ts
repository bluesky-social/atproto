/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface Main {
  uri: string
  cid?: string
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'com.atproto.repo.recordRef#main' ||
      v.$type === 'com.atproto.repo.recordRef')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.recordRef#main', v)
}

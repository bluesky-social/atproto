/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface Main {
  did: string
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'com.atproto.repo.repoRef#main' ||
      v.$type === 'com.atproto.repo.repoRef')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.repoRef#main', v)
}

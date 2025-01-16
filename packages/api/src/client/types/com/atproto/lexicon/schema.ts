/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface Record {
  /** Indicates the 'version' of the Lexicon language. Must be '1' for the current atproto/Lexicon schema system. */
  lexicon: number
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'com.atproto.lexicon.schema#main' ||
      v.$type === 'com.atproto.lexicon.schema')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.lexicon.schema#main', v)
}

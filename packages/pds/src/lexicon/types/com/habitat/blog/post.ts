/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Record {
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'com.habitat.blog.post#main' ||
      v.$type === 'com.habitat.blog.post')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('com.habitat.blog.post#main', v)
}

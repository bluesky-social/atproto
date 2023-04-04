/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Main {
  index: ByteSlice
  features: (Mention | Link | { $type: string; [k: string]: unknown })[]
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.richtext.facet#main' ||
      v.$type === 'app.bsky.richtext.facet')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.richtext.facet#main', v)
}

/** A facet feature for actor mentions. */
export interface Mention {
  did: string
  [k: string]: unknown
}

export function isMention(v: unknown): v is Mention {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.richtext.facet#mention'
  )
}

export function validateMention(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.richtext.facet#mention', v)
}

/** A facet feature for links. */
export interface Link {
  uri: string
  [k: string]: unknown
}

export function isLink(v: unknown): v is Link {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.richtext.facet#link'
  )
}

export function validateLink(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.richtext.facet#link', v)
}

/** A text segment. Start is inclusive, end is exclusive. Indices are for utf8-encoded strings. */
export interface ByteSlice {
  byteStart: number
  byteEnd: number
  [k: string]: unknown
}

export function isByteSlice(v: unknown): v is ByteSlice {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.richtext.facet#byteSlice'
  )
}

export function validateByteSlice(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.richtext.facet#byteSlice', v)
}

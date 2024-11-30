/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

/** Annotation of a sub-string within rich text. */
export interface Main {
  index: ByteSlice
  features: (Mention | Link | Tag | { $type: string; [k: string]: unknown })[]
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

/** Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID. */
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

/** Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL. */
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

/** Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags'). */
export interface Tag {
  tag: string
  [k: string]: unknown
}

export function isTag(v: unknown): v is Tag {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.richtext.facet#tag'
  )
}

export function validateTag(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.richtext.facet#tag', v)
}

/** Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets. */
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

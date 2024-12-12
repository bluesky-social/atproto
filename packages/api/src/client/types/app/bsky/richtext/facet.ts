/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'app.bsky.richtext.facet'

/** Annotation of a sub-string within rich text. */
export interface Main {
  index: ByteSlice
  features: (Mention | Link | Tag | { $type: string; [k: string]: unknown })[]
  [k: string]: unknown
}

export function isMain(
  v: unknown,
): v is Main & { $type: $Type<'app.bsky.richtext.facet', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

/** Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID. */
export interface Mention {
  did: string
  [k: string]: unknown
}

export function isMention(
  v: unknown,
): v is Mention & { $type: $Type<'app.bsky.richtext.facet', 'mention'> } {
  return is$typed(v, id, 'mention')
}

export function validateMention(v: unknown) {
  return lexicons.validate(`${id}#mention`, v) as ValidationResult<Mention>
}

/** Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL. */
export interface Link {
  uri: string
  [k: string]: unknown
}

export function isLink(
  v: unknown,
): v is Link & { $type: $Type<'app.bsky.richtext.facet', 'link'> } {
  return is$typed(v, id, 'link')
}

export function validateLink(v: unknown) {
  return lexicons.validate(`${id}#link`, v) as ValidationResult<Link>
}

/** Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags'). */
export interface Tag {
  tag: string
  [k: string]: unknown
}

export function isTag(
  v: unknown,
): v is Tag & { $type: $Type<'app.bsky.richtext.facet', 'tag'> } {
  return is$typed(v, id, 'tag')
}

export function validateTag(v: unknown) {
  return lexicons.validate(`${id}#tag`, v) as ValidationResult<Tag>
}

/** Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets. */
export interface ByteSlice {
  byteStart: number
  byteEnd: number
  [k: string]: unknown
}

export function isByteSlice(
  v: unknown,
): v is ByteSlice & { $type: $Type<'app.bsky.richtext.facet', 'byteSlice'> } {
  return is$typed(v, id, 'byteSlice')
}

export function validateByteSlice(v: unknown) {
  return lexicons.validate(`${id}#byteSlice`, v) as ValidationResult<ByteSlice>
}

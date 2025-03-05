/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.richtext.facet'

/** Annotation of a sub-string within rich text. */
export interface Main {
  $type?: 'app.bsky.richtext.facet'
  index: ByteSlice
  features: ($Typed<Mention> | $Typed<Link> | $Typed<Tag> | { $type: string })[]
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain)
}

/** Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID. */
export interface Mention {
  $type?: 'app.bsky.richtext.facet#mention'
  did: string
}

const hashMention = 'mention'

export function isMention<V>(v: V) {
  return is$typed(v, id, hashMention)
}

export function validateMention<V>(v: V) {
  return validate<Mention & V>(v, id, hashMention)
}

/** Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL. */
export interface Link {
  $type?: 'app.bsky.richtext.facet#link'
  uri: string
}

const hashLink = 'link'

export function isLink<V>(v: V) {
  return is$typed(v, id, hashLink)
}

export function validateLink<V>(v: V) {
  return validate<Link & V>(v, id, hashLink)
}

/** Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags'). */
export interface Tag {
  $type?: 'app.bsky.richtext.facet#tag'
  tag: string
}

const hashTag = 'tag'

export function isTag<V>(v: V) {
  return is$typed(v, id, hashTag)
}

export function validateTag<V>(v: V) {
  return validate<Tag & V>(v, id, hashTag)
}

/** Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets. */
export interface ByteSlice {
  $type?: 'app.bsky.richtext.facet#byteSlice'
  byteStart: number
  byteEnd: number
}

const hashByteSlice = 'byteSlice'

export function isByteSlice<V>(v: V) {
  return is$typed(v, id, hashByteSlice)
}

export function validateByteSlice<V>(v: V) {
  return validate<ByteSlice & V>(v, id, hashByteSlice)
}

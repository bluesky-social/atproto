/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'app.bsky.richtext.facet'

/** Annotation of a sub-string within rich text. */
export interface Main {
  $type?: $Type<'app.bsky.richtext.facet', 'main'>
  index: ByteSlice
  features: ($Typed<Mention> | $Typed<Link> | $Typed<Tag> | { $type: string })[]
}

export function isMain<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export function isValidMain<V>(v: V): v is V & $Typed<Main> {
  return isMain(v) && validateMain(v).success
}

/** Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID. */
export interface Mention {
  $type?: $Type<'app.bsky.richtext.facet', 'mention'>
  did: string
}

export function isMention<V>(v: V) {
  return is$typed(v, id, 'mention')
}

export function validateMention(v: unknown) {
  return lexicons.validate(`${id}#mention`, v) as ValidationResult<Mention>
}

export function isValidMention<V>(v: V): v is V & $Typed<Mention> {
  return isMention(v) && validateMention(v).success
}

/** Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL. */
export interface Link {
  $type?: $Type<'app.bsky.richtext.facet', 'link'>
  uri: string
}

export function isLink<V>(v: V) {
  return is$typed(v, id, 'link')
}

export function validateLink(v: unknown) {
  return lexicons.validate(`${id}#link`, v) as ValidationResult<Link>
}

export function isValidLink<V>(v: V): v is V & $Typed<Link> {
  return isLink(v) && validateLink(v).success
}

/** Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags'). */
export interface Tag {
  $type?: $Type<'app.bsky.richtext.facet', 'tag'>
  tag: string
}

export function isTag<V>(v: V) {
  return is$typed(v, id, 'tag')
}

export function validateTag(v: unknown) {
  return lexicons.validate(`${id}#tag`, v) as ValidationResult<Tag>
}

export function isValidTag<V>(v: V): v is V & $Typed<Tag> {
  return isTag(v) && validateTag(v).success
}

/** Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets. */
export interface ByteSlice {
  $type?: $Type<'app.bsky.richtext.facet', 'byteSlice'>
  byteStart: number
  byteEnd: number
}

export function isByteSlice<V>(v: V) {
  return is$typed(v, id, 'byteSlice')
}

export function validateByteSlice(v: unknown) {
  return lexicons.validate(`${id}#byteSlice`, v) as ValidationResult<ByteSlice>
}

export function isValidByteSlice<V>(v: V): v is V & $Typed<ByteSlice> {
  return isByteSlice(v) && validateByteSlice(v).success
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'app.bsky.unspecced.getTaggedSuggestions'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  suggestions: Suggestion[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface Suggestion {
  $type?: $Type<'app.bsky.unspecced.getTaggedSuggestions', 'suggestion'>
  tag: string
  subjectType: 'actor' | 'feed' | (string & {})
  subject: string
}

export function isSuggestion<V>(v: V) {
  return is$typed(v, id, 'suggestion')
}

export function validateSuggestion(v: unknown) {
  return lexicons.validate(
    `${id}#suggestion`,
    v,
  ) as ValidationResult<Suggestion>
}

export function isValidSuggestion<V>(v: V): v is V & $Typed<Suggestion> {
  return isSuggestion(v) && validateSuggestion(v).success
}

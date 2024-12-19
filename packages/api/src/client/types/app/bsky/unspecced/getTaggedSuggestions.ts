/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'app.bsky.unspecced.getTaggedSuggestions'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  suggestions: Suggestion[]
  [k: string]: unknown
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
  tag: string
  subjectType: 'actor' | 'feed' | (string & {})
  subject: string
  [k: string]: unknown
}

export function isSuggestion(v: unknown): v is Suggestion & {
  $type: $Type<'app.bsky.unspecced.getTaggedSuggestions', 'suggestion'>
} {
  return is$typed(v, id, 'suggestion')
}

export function validateSuggestion(v: unknown) {
  return lexicons.validate(
    `${id}#suggestion`,
    v,
  ) as ValidationResult<Suggestion>
}

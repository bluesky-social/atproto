/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

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

export function isSuggestion(v: unknown): v is Suggestion {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.unspecced.getTaggedSuggestions#suggestion'
  )
}

export function validateSuggestion(v: unknown): ValidationResult {
  return lexicons.validate(
    'app.bsky.unspecced.getTaggedSuggestions#suggestion',
    v,
  )
}

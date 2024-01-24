/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
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
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
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

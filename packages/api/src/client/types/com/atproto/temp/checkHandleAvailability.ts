/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
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
const id = 'com.atproto.temp.checkHandleAvailability'

export type QueryParams = {
  /** Tentative handle. Will be checked for availability or used to build handle suggestions. */
  handle: string
  /** User-provided email. Might be used to build handle suggestions. */
  email?: string
  /** User-provided birth date. Might be used to build handle suggestions. */
  birthDate?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** Echo of the input handle. */
  handle: string
  result:
    | $Typed<ResultAvailable>
    | $Typed<ResultUnavailable>
    | { $type: string }
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

export class InvalidEmailError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidEmail') return new InvalidEmailError(e)
  }

  return e
}

/** Indicates the provided handle is available. */
export interface ResultAvailable {
  $type?: 'com.atproto.temp.checkHandleAvailability#resultAvailable'
}

const hashResultAvailable = 'resultAvailable'

export function isResultAvailable<V>(v: V) {
  return is$typed(v, id, hashResultAvailable)
}

export function validateResultAvailable<V>(v: V) {
  return validate<ResultAvailable & V>(v, id, hashResultAvailable)
}

/** Indicates the provided handle is unavailable and gives suggestions of available handles. */
export interface ResultUnavailable {
  $type?: 'com.atproto.temp.checkHandleAvailability#resultUnavailable'
  /** List of suggested handles based on the provided inputs. */
  suggestions: Suggestion[]
}

const hashResultUnavailable = 'resultUnavailable'

export function isResultUnavailable<V>(v: V) {
  return is$typed(v, id, hashResultUnavailable)
}

export function validateResultUnavailable<V>(v: V) {
  return validate<ResultUnavailable & V>(v, id, hashResultUnavailable)
}

export interface Suggestion {
  $type?: 'com.atproto.temp.checkHandleAvailability#suggestion'
  handle: string
  /** Method used to build this suggestion. Should be considered opaque to clients. Can be used for metrics. */
  method: string
}

const hashSuggestion = 'suggestion'

export function isSuggestion<V>(v: V) {
  return is$typed(v, id, hashSuggestion)
}

export function validateSuggestion<V>(v: V) {
  return validate<Suggestion & V>(v, id, hashSuggestion)
}

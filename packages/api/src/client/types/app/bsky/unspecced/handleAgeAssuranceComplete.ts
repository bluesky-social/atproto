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
const id = 'app.bsky.unspecced.handleAgeAssuranceComplete'

export interface QueryParams {
  /** The status of the age assurance process. */
  status?: string
  /** Additional metadata provided when initiating age assurance. */
  externalPayload?: string
  /** SHA256 HMAC signature of the status and externalPayload, separated by a colon (:), and signed with the facilitating service's private key. */
  signature?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  /** The computed status of the age assurance process. */
  status: 'unknown' | 'pending' | 'assured' | (string & {})
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

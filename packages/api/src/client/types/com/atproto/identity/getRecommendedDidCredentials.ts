/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'com.atproto.identity.getRecommendedDidCredentials'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  /** Recommended rotation keys for PLC dids. Should be undefined (or ignored) for did:webs. */
  rotationKeys?: string[]
  alsoKnownAs?: string[]
  verificationMethods?: { [_ in string]: unknown }
  services?: { [_ in string]: unknown }
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

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
const id = 'com.atproto.server.createAppPassword'

export interface QueryParams {}

export interface InputSchema {
  /** A short name for the App Password, to help distinguish them. */
  name: string
  /** If an app password has 'privileged' access to possibly sensitive account state. Meant for use with trusted clients. */
  privileged?: boolean
}

export type OutputSchema = AppPassword

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class AccountTakedownError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AccountTakedown') return new AccountTakedownError(e)
  }

  return e
}

export interface AppPassword {
  $type?: $Type<'com.atproto.server.createAppPassword', 'appPassword'>
  name: string
  password: string
  createdAt: string
  privileged?: boolean
}

const hashAppPassword = 'appPassword'

export function isAppPassword<V>(v: V) {
  return is$typed(v, id, hashAppPassword)
}

export function validateAppPassword<V>(v: V) {
  return validate<AppPassword & V>(v, id, hashAppPassword)
}

export function isValidAppPassword<V>(v: V) {
  return isValid<AppPassword & V>(v, id, hashAppPassword)
}

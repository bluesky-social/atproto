/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.server.createAppPassword'

export interface QueryParams {}

export interface InputSchema {
  /** A short name for the App Password, to help distinguish them. */
  name: string
  /** If an app password has 'privileged' access to possibly sensitive account state. Meant for use with trusted clients. */
  privileged?: boolean
  [k: string]: unknown
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
  name: string
  password: string
  createdAt: string
  privileged?: boolean
  [k: string]: unknown
}

export function isAppPassword(v: unknown): v is AppPassword & {
  $type: $Type<'com.atproto.server.createAppPassword', 'appPassword'>
} {
  return is$typed(v, id, 'appPassword')
}

export function validateAppPassword(v: unknown) {
  return lexicons.validate(
    `${id}#appPassword`,
    v,
  ) as ValidationResult<AppPassword>
}

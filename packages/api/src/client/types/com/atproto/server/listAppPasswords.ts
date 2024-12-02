/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.server.listAppPasswords'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  passwords: AppPassword[]
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
  $type?: $Type<'com.atproto.server.listAppPasswords', 'appPassword'>
  name: string
  createdAt: string
  privileged?: boolean
}

export function isAppPassword<V>(v: V) {
  return is$typed(v, id, 'appPassword')
}

export function validateAppPassword(v: unknown) {
  return lexicons.validate(
    `${id}#appPassword`,
    v,
  ) as ValidationResult<AppPassword>
}

export function isValidAppPassword<V>(v: V): v is V & $Typed<AppPassword> {
  return isAppPassword(v) && validateAppPassword(v).success
}

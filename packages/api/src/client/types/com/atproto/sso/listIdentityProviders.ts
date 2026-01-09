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
const id = 'com.atproto.sso.listIdentityProviders'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  identityProviders: IdentityProvider[]
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

export interface IdentityProvider {
  $type?: 'com.atproto.sso.listIdentityProviders#identityProvider'
  id: string
  name?: string
  icon?: string
}

const hashIdentityProvider = 'identityProvider'

export function isIdentityProvider<V>(v: V) {
  return is$typed(v, id, hashIdentityProvider)
}

export function validateIdentityProvider<V>(v: V) {
  return validate<IdentityProvider & V>(v, id, hashIdentityProvider)
}

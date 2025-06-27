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
const id = 'com.atproto.server.refreshSession'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  accessJwt: string
  refreshJwt: string
  handle: string
  did: string
  didDoc?: { [_ in string]: unknown }
  active?: boolean
  /** Hosting status of the account. If not specified, then assume 'active'. */
  status?: 'takendown' | 'suspended' | 'deactivated' | (string & {})
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
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

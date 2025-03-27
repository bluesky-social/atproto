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
const id = 'com.atproto.sync.listRepos'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  repos: Repo[]
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

export interface Repo {
  $type?: 'com.atproto.sync.listRepos#repo'
  did: string
  /** Current repo commit CID */
  head: string
  rev: string
  active?: boolean
  /** If active=false, this optional field indicates a possible reason for why the account is not active. If active=false and no status is supplied, then the host makes no claim for why the repository is no longer being hosted. */
  status?:
    | 'takendown'
    | 'suspended'
    | 'deleted'
    | 'deactivated'
    | 'desynchronized'
    | 'throttled'
    | (string & {})
}

const hashRepo = 'repo'

export function isRepo<V>(v: V) {
  return is$typed(v, id, hashRepo)
}

export function validateRepo<V>(v: V) {
  return validate<Repo & V>(v, id, hashRepo)
}

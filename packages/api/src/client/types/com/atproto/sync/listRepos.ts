/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.sync.listRepos'

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
  $type?: $Type<'com.atproto.sync.listRepos', 'repo'>
  did: string
  /** Current repo commit CID */
  head: string
  rev: string
  active?: boolean
  /** If active=false, this optional field indicates a possible reason for why the account is not active. If active=false and no status is supplied, then the host makes no claim for why the repository is no longer being hosted. */
  status?: 'takendown' | 'suspended' | 'deactivated' | (string & {})
}

export function isRepo<V>(v: V) {
  return is$typed(v, id, 'repo')
}

export function validateRepo(v: unknown) {
  return lexicons.validate(`${id}#repo`, v) as ValidationResult<Repo>
}

export function isValidRepo<V>(v: V): v is V & $Typed<Repo> {
  return isRepo(v) && validateRepo(v).success
}

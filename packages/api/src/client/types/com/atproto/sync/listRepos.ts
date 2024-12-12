/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.sync.listRepos'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  repos: Repo[]
  [k: string]: unknown
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
  did: string
  /** Current repo commit CID */
  head: string
  rev: string
  active?: boolean
  /** If active=false, this optional field indicates a possible reason for why the account is not active. If active=false and no status is supplied, then the host makes no claim for why the repository is no longer being hosted. */
  status?: 'takendown' | 'suspended' | 'deactivated' | (string & {})
  [k: string]: unknown
}

export function isRepo(
  v: unknown,
): v is Repo & { $type: $Type<'com.atproto.sync.listRepos', 'repo'> } {
  return is$typed(v, id, 'repo')
}

export function validateRepo(v: unknown) {
  return lexicons.validate(`${id}#repo`, v) as ValidationResult<Repo>
}

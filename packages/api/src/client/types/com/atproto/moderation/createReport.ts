/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoModerationDefs from './defs'
import * as ComAtprotoAdminDefs from '../admin/defs'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  reasonType: ComAtprotoModerationDefs.ReasonType
  /** Additional context about the content and violation. */
  reason?: string
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface OutputSchema {
  id: number
  reasonType: ComAtprotoModerationDefs.ReasonType
  reason?: string
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  reportedBy: string
  createdAt: string
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

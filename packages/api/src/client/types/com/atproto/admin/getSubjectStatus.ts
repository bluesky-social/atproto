/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDefs from './defs'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

const id = 'com.atproto.admin.getSubjectStatus'

export interface QueryParams {
  did?: string
  uri?: string
  blob?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | ComAtprotoAdminDefs.RepoBlobRef
    | { $type: string; [k: string]: unknown }
  takedown?: ComAtprotoAdminDefs.StatusAttr
  deactivated?: ComAtprotoAdminDefs.StatusAttr
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

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDefs from './defs'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export const id = 'com.atproto.admin.updateSubjectStatus'

export interface QueryParams {}

export interface InputSchema {
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | $Typed<ComAtprotoAdminDefs.RepoBlobRef>
    | { $type: string }
  takedown?: ComAtprotoAdminDefs.StatusAttr
  deactivated?: ComAtprotoAdminDefs.StatusAttr
}

export interface OutputSchema {
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | $Typed<ComAtprotoAdminDefs.RepoBlobRef>
    | { $type: string }
  takedown?: ComAtprotoAdminDefs.StatusAttr
}

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

export function toKnownErr(e: any) {
  return e
}

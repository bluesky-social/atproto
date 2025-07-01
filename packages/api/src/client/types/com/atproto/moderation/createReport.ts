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
import type * as ComAtprotoModerationDefs from './defs.js'
import type * as ComAtprotoAdminDefs from '../admin/defs.js'
import type * as ComAtprotoRepoStrongRef from '../repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.moderation.createReport'

export interface QueryParams {}

export interface InputSchema {
  reasonType: ComAtprotoModerationDefs.ReasonType
  /** Additional context about the content and violation. */
  reason?: string
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  modTool?: ModTool
}

export interface OutputSchema {
  id: number
  reasonType: ComAtprotoModerationDefs.ReasonType
  reason?: string
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  reportedBy: string
  createdAt: string
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

/** Moderation tool information for tracing the source of the action */
export interface ModTool {
  $type?: 'com.atproto.moderation.createReport#modTool'
  /** Name/identifier of the source (e.g., 'bsky-app/android', 'bsky-web/chrome') */
  name: string
  /** Additional arbitrary metadata about the source */
  meta?: { [_ in string]: unknown }
}

const hashModTool = 'modTool'

export function isModTool<V>(v: V) {
  return is$typed(v, id, hashModTool)
}

export function validateModTool<V>(v: V) {
  return validate<ModTool & V>(v, id, hashModTool)
}

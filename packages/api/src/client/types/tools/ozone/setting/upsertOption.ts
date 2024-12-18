/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ToolsOzoneSettingDefs from './defs'

const id = 'tools.ozone.setting.upsertOption'

export interface QueryParams {}

export interface InputSchema {
  key: string
  scope: 'instance' | 'personal' | (string & {})
  value: {}
  description?: string
  managerRole?:
    | 'tools.ozone.team.defs#roleModerator'
    | 'tools.ozone.team.defs#roleTriage'
    | 'tools.ozone.team.defs#roleAdmin'
    | (string & {})
  [k: string]: unknown
}

export interface OutputSchema {
  option: ToolsOzoneSettingDefs.Option
  [k: string]: unknown
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

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
import type * as ToolsOzoneSettingDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.setting.listOptions'

export type QueryParams = {
  limit?: number
  cursor?: string
  scope?: 'instance' | 'personal' | (string & {})
  /** Filter keys by prefix */
  prefix?: string
  /** Filter for only the specified keys. Ignored if prefix is provided */
  keys?: string[]
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  options: ToolsOzoneSettingDefs.Option[]
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

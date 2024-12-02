/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ToolsOzoneModerationDefs from './defs'

export const id = 'tools.ozone.moderation.getRepos'

export interface QueryParams {
  dids: string[]
}

export type InputSchema = undefined

export interface OutputSchema {
  repos: (
    | $Typed<ToolsOzoneModerationDefs.RepoViewDetail>
    | $Typed<ToolsOzoneModerationDefs.RepoViewNotFound>
    | { $type: string }
  )[]
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

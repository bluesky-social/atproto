/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'tools.ozone.server.getConfig'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  appview?: ServiceConfig
  pds?: ServiceConfig
  blobDivert?: ServiceConfig
  chat?: ServiceConfig
  viewer?: ViewerConfig
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

export interface ServiceConfig {
  url?: string
  [k: string]: unknown
}

export function isServiceConfig(v: unknown): v is ServiceConfig & {
  $type: $Type<'tools.ozone.server.getConfig', 'serviceConfig'>
} {
  return is$typed(v, id, 'serviceConfig')
}

export function validateServiceConfig(v: unknown) {
  return lexicons.validate(
    `${id}#serviceConfig`,
    v,
  ) as ValidationResult<ServiceConfig>
}

export interface ViewerConfig {
  role?:
    | 'tools.ozone.team.defs#roleAdmin'
    | 'tools.ozone.team.defs#roleModerator'
    | 'tools.ozone.team.defs#roleTriage'
    | (string & {})
  [k: string]: unknown
}

export function isViewerConfig(v: unknown): v is ViewerConfig & {
  $type: $Type<'tools.ozone.server.getConfig', 'viewerConfig'>
} {
  return is$typed(v, id, 'viewerConfig')
}

export function validateViewerConfig(v: unknown) {
  return lexicons.validate(
    `${id}#viewerConfig`,
    v,
  ) as ValidationResult<ViewerConfig>
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'tools.ozone.server.getConfig'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  appview?: ServiceConfig
  pds?: ServiceConfig
  blobDivert?: ServiceConfig
  chat?: ServiceConfig
  viewer?: ViewerConfig
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
  $type?: $Type<'tools.ozone.server.getConfig', 'serviceConfig'>
  url?: string
}

export function isServiceConfig<V>(v: V) {
  return is$typed(v, id, 'serviceConfig')
}

export function validateServiceConfig(v: unknown) {
  return lexicons.validate(
    `${id}#serviceConfig`,
    v,
  ) as ValidationResult<ServiceConfig>
}

export function isValidServiceConfig<V>(v: V): v is V & $Typed<ServiceConfig> {
  return isServiceConfig(v) && validateServiceConfig(v).success
}

export interface ViewerConfig {
  $type?: $Type<'tools.ozone.server.getConfig', 'viewerConfig'>
  role?:
    | 'tools.ozone.team.defs#roleAdmin'
    | 'tools.ozone.team.defs#roleModerator'
    | 'tools.ozone.team.defs#roleTriage'
    | (string & {})
}

export function isViewerConfig<V>(v: V) {
  return is$typed(v, id, 'viewerConfig')
}

export function validateViewerConfig(v: unknown) {
  return lexicons.validate(
    `${id}#viewerConfig`,
    v,
  ) as ValidationResult<ViewerConfig>
}

export function isValidViewerConfig<V>(v: V): v is V & $Typed<ViewerConfig> {
  return isViewerConfig(v) && validateViewerConfig(v).success
}

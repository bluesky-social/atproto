/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

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

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

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

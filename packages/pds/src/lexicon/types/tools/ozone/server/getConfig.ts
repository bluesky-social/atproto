/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

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
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface ServiceConfig {
  url?: string
  [k: string]: unknown
}

export function isServiceConfig(v: unknown): v is ServiceConfig {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.server.getConfig#serviceConfig'
  )
}

export function validateServiceConfig(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.server.getConfig#serviceConfig', v)
}

export interface ViewerConfig {
  role?:
    | 'tools.ozone.team.defs#roleAdmin'
    | 'tools.ozone.team.defs#roleModerator'
    | 'tools.ozone.team.defs#roleTriage'
    | (string & {})
  [k: string]: unknown
}

export function isViewerConfig(v: unknown): v is ViewerConfig {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.server.getConfig#viewerConfig'
  )
}

export function validateViewerConfig(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.server.getConfig#viewerConfig', v)
}

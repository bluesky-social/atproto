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

export interface InputSchema {
  didPayload?:
    | DidPlcPayload
    | DidWebPayload
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | void
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

export interface DidPlcPayload {
  did: string
  op: {}
  [k: string]: unknown
}

export function isDidPlcPayload(v: unknown): v is DidPlcPayload {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.finalizeImport#didPlcPayload'
  )
}

export function validateDidPlcPayload(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.finalizeImport#didPlcPayload', v)
}

export interface DidWebPayload {
  did: string
  [k: string]: unknown
}

export function isDidWebPayload(v: unknown): v is DidWebPayload {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.finalizeImport#didWebPayload'
  )
}

export function validateDidWebPayload(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.finalizeImport#didWebPayload', v)
}

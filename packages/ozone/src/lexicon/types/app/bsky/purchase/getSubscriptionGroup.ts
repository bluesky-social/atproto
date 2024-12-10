/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export interface QueryParams {
  group: 'core' | (string & {})
  platform: 'android' | 'ios' | 'web' | (string & {})
}

export type InputSchema = undefined

export interface OutputSchema {
  group?: 'core' | (string & {})
  offerings?: Offering[]
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
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface Offering {
  id?: 'core:annual' | 'core:monthly' | (string & {})
  platform?: 'android' | 'ios' | 'web' | (string & {})
  product?: string
  [k: string]: unknown
}

export function isOffering(v: unknown): v is Offering {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.purchase.getSubscriptionGroup#offering'
  )
}

export function validateOffering(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.purchase.getSubscriptionGroup#offering', v)
}

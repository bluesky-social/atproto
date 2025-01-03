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
  email?: string
  subscriptions: Subscription[]
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

export interface Subscription {
  status?: 'active' | 'expired' | 'paused' | 'unknown' | (string & {})
  renewalStatus?:
    | 'unknown'
    | 'will_not_renew'
    | 'will_pause'
    | 'will_renew'
    | (string & {})
  group?: 'core' | (string & {})
  platform?: 'android' | 'ios' | 'web' | (string & {})
  offering?: 'core:annual' | 'core:monthly' | (string & {})
  periodEndsAt?: string
  periodStartsAt?: string
  purchasedAt?: string
  [k: string]: unknown
}

export function isSubscription(v: unknown): v is Subscription {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.purchase.getSubscriptions#subscription'
  )
}

export function validateSubscription(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.purchase.getSubscriptions#subscription', v)
}

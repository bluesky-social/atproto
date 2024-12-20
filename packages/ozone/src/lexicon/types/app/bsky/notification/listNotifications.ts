/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import type * as AppBskyActorDefs from '../actor/defs'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.notification.listNotifications'

export interface QueryParams {
  /** Notification reasons to include in response. */
  reasons?: string[]
  limit: number
  priority?: boolean
  cursor?: string
  seenAt?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  notifications: Notification[]
  priority?: boolean
  seenAt?: string
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

export interface Notification {
  $type?: $Type<'app.bsky.notification.listNotifications', 'notification'>
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileView
  /** Expected values are 'like', 'repost', 'follow', 'mention', 'reply', 'quote', and 'starterpack-joined'. */
  reason:
    | 'like'
    | 'repost'
    | 'follow'
    | 'mention'
    | 'reply'
    | 'quote'
    | 'starterpack-joined'
    | (string & {})
  reasonSubject?: string
  record: { [_ in string]: unknown }
  isRead: boolean
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
}

const hashNotification = 'notification'

export function isNotification<V>(v: V) {
  return is$typed(v, id, hashNotification)
}

export function validateNotification<V>(v: V) {
  return validate<Notification & V>(v, id, hashNotification)
}

export function isValidNotification<V>(v: V) {
  return isValid<Notification>(v, id, hashNotification)
}

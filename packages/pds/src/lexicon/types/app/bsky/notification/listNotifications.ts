/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as AppBskyActorDefs from '../actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'app.bsky.notification.listNotifications'

export interface QueryParams {
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

export function isNotification<V>(v: V) {
  return is$typed(v, id, 'notification')
}

export function validateNotification(v: unknown) {
  return lexicons.validate(
    `${id}#notification`,
    v,
  ) as ValidationResult<Notification>
}

export function isValidNotification<V>(v: V): v is V & $Typed<Notification> {
  return isNotification(v) && validateNotification(v).success
}

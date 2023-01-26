/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  notifications: Notification[]
  [k: string]: unknown
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

export interface Notification {
  uri: string
  cid: string
  author: AppBskyActorRef.WithInfo
  /** Expected values are 'vote', 'repost', 'follow', 'invite', 'mention' and 'reply'. */
  reason:
    | 'vote'
    | 'repost'
    | 'follow'
    | 'invite'
    | 'mention'
    | 'reply'
    | (string & {})
  reasonSubject?: string
  record: {}
  isRead: boolean
  indexedAt: string
  [k: string]: unknown
}

export function isNotification(v: unknown): v is Notification {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.notification.list#notification'
  )
}

export function validateNotification(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.notification.list#notification', v)
}

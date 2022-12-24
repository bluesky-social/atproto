/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyAdminModerationAction from './moderationAction'

export interface QueryParams {}

export interface InputSchema {
  action: 'app.bsky.admin.actionTakedown' | (string & {})
  subject: AppBskyActorRef.Main | { $type: string; [k: string]: unknown }
  reason: string
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = AppBskyAdminModerationAction.View

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

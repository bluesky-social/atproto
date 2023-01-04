/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as ComAtprotoRepoRepoRef from '../repo/repoRef'
import * as ComAtprotoRepoRecordRef from '../repo/recordRef'
import * as ComAtprotoAdminModerationAction from './moderationAction'

export interface QueryParams {}

export interface InputSchema {
  action:
    | 'com.atproto.admin.moderationAction#takedown'
    | 'com.atproto.admin.moderationAction#flag'
    | 'com.atproto.admin.moderationAction#acknowledge'
    | (string & {})
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoRecordRef.Main
    | { $type: string; [k: string]: unknown }
  reason: string
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminModerationAction.View

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

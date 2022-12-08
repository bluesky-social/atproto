/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  actor: string
}

export type InputSchema = undefined

export interface OutputSchema {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  creator: string
  displayName?: string
  description?: string
  avatar?: string
  followersCount: number
  followsCount: number
  membersCount: number
  postsCount: number
  myState?: MyState
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
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

export interface MyState {
  follow?: string
  member?: string
  [k: string]: unknown
}

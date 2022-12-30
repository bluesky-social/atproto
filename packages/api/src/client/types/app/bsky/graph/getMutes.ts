/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  mutes: Mute[]
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

export interface Mute {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  createdAt: string
  [k: string]: unknown
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  actors: Actor[]
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

export interface Actor {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  indexedAt?: string
  myState?: MyState
  [k: string]: unknown
}

export interface MyState {
  follow?: string
  [k: string]: unknown
}

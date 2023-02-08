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
  [k: string]: unknown
}

<<<<<<< HEAD
export interface MyState {
  follow?: string
  [k: string]: unknown
=======
export function isActor(v: unknown): v is Actor {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.getSuggestions#actor'
  )
}

export function validateActor(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.getSuggestions#actor', v)
>>>>>>> e8b8d081aefbd480e2a30d74fcba203635a37c93
}

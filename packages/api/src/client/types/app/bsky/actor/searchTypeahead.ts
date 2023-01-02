/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  term: string
  limit?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  users: User[]
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

export interface User {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  avatar?: string
  [k: string]: unknown
}

export function isUser(v: unknown): v is User {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.searchTypeahead#user'
  )
}

export function validateUser(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.searchTypeahead#user', v)
}

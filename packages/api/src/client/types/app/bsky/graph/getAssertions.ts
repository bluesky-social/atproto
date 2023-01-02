/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  author?: string
  subject?: string
  assertion?: string
  confirmed?: boolean
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  assertions: Assertion[]
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

export interface Assertion {
  uri: string
  cid: string
  assertion: string
  confirmation?: Confirmation
  author: AppBskyActorRef.WithInfo
  subject: AppBskyActorRef.WithInfo
  indexedAt: string
  createdAt: string
  [k: string]: unknown
}

export function isAssertion(v: unknown): v is Assertion {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getAssertions#assertion'
  )
}

export function validateAssertion(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getAssertions#assertion', v)
}

export interface Confirmation {
  uri: string
  cid: string
  indexedAt: string
  createdAt: string
  [k: string]: unknown
}

export function isConfirmation(v: unknown): v is Confirmation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getAssertions#confirmation'
  )
}

export function validateConfirmation(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getAssertions#confirmation', v)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  actor: string
}

export type InputSchema = undefined

export interface OutputSchema {
  day: Metadata
  month: Metadata
  all: Metadata
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

export interface Metadata {
  messagesSent: number
  messagesReceived: number
  convos: number
  convosStarted: number
  [k: string]: unknown
}

export function isMetadata(v: unknown): v is Metadata {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.moderation.getActorMetadata#metadata'
  )
}

export function validateMetadata(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.moderation.getActorMetadata#metadata', v)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'chat.bsky.moderation.getActorMetadata'

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
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface Metadata {
  messagesSent: number
  messagesReceived: number
  convos: number
  convosStarted: number
  [k: string]: unknown
}

export function isMetadata(v: unknown): v is Metadata & {
  $type: $Type<'chat.bsky.moderation.getActorMetadata', 'metadata'>
} {
  return is$typed(v, id, 'metadata')
}

export function validateMetadata(v: unknown) {
  return lexicons.validate(`${id}#metadata`, v) as ValidationResult<Metadata>
}

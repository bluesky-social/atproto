/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  /** Users that have access to the service and their levels of access. */
  moderators: Moderator[]
  did: string
  /** The URL of the PLC server. */
  plcUrl?: string
  /** Configuration used to split subjects in multiple queues. */
  queueConfig?: {}
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

export interface Moderator {
  did?: string
  handle?: string
  role?: 'admin' | 'moderator' | 'triage'
  [k: string]: unknown
}

export function isModerator(v: unknown): v is Moderator {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.server.describeServer#moderator'
  )
}

export function validateModerator(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.server.describeServer#moderator', v)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.admin.sendEmail'

export interface QueryParams {}

export interface InputSchema {
  recipientDid: string
  content: string
  subject?: string
  senderDid: string
  /** Additional comment by the sender that won't be used in the email itself but helpful to provide more context for moderators/reviewers */
  comment?: string
  [k: string]: unknown
}

export interface OutputSchema {
  sent: boolean
  [k: string]: unknown
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './defs'

export interface QueryParams {}

export interface InputSchema {
  /** Name of the template. */
  name: string
  /** Content of the template, markdown supported, can contain variable placeholders. */
  contentMarkdown: string
  /** Subject of the message, used in emails. */
  subject: string
  /** DID of the user who is creating the template. */
  createdBy?: string
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminDefs.CommunicationTemplateView

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
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

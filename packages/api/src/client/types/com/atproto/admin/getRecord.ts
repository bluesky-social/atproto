/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as ComAtprotoAdminRecord from './record'

export interface QueryParams {
  uri: string
  cid?: string
}

export type InputSchema = undefined
export type OutputSchema = ComAtprotoAdminRecord.ViewDetail

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

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {
  /** The handle or DID of the repo. */
  user: string
  /** The NSID of the record type. */
  collection: string
  /** The number of records to return. */
  limit?: number
  /** A TID to filter the range of records returned. */
  before?: string
  /** A TID to filter the range of records returned. */
  after?: string
  /** Reverse the order of the returned records? */
  reverse?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  records: Record[]
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

export interface Record {
  uri: string
  cid: string
  value: {}
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.listRecords#record'
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.listRecords#record', v)
}

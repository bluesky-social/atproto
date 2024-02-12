/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {}

export interface InputSchema {
  didPayload?:
    | DidPlcPayload
    | DidWebPayload
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface DidPlcPayload {
  did: string
  op: {}
  [k: string]: unknown
}

export function isDidPlcPayload(v: unknown): v is DidPlcPayload {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.finalizeImport#didPlcPayload'
  )
}

export function validateDidPlcPayload(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.finalizeImport#didPlcPayload', v)
}

export interface DidWebPayload {
  did: string
  [k: string]: unknown
}

export function isDidWebPayload(v: unknown): v is DidWebPayload {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.finalizeImport#didWebPayload'
  )
}

export function validateDidWebPayload(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.finalizeImport#didWebPayload', v)
}

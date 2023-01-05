/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string
  /** Validate the records? */
  validate?: boolean
  writes: (Create | Update | Delete)[]
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

export interface Create {
  action: 'create'
  collection: string
  rkey?: string
  value: {}
  [k: string]: unknown
}

export function isCreate(v: unknown): v is Create {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.batchWrite#create'
  )
}

export function validateCreate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.batchWrite#create', v)
}

export interface Update {
  action: 'update'
  collection: string
  rkey: string
  value: {}
  [k: string]: unknown
}

export function isUpdate(v: unknown): v is Update {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.batchWrite#update'
  )
}

export function validateUpdate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.batchWrite#update', v)
}

export interface Delete {
  action: 'delete'
  collection: string
  rkey: string
  [k: string]: unknown
}

export function isDelete(v: unknown): v is Delete {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.batchWrite#delete'
  )
}

export function validateDelete(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.batchWrite#delete', v)
}

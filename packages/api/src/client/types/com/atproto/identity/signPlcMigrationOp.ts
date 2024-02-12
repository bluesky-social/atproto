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
  /** The new handle. */
  handle?: string
  /** The new signing key, formatted as a `did:key`. Normally provided by the service that the account is migrating to. */
  signingKey?: string
  /** An array of rotation keys, formatted as `did:key`s, ordered by highest to least authority. Normally provided by the service that the account is migrating to. */
  rotationKeys?: string[]
  /** The endpoint for the PDS that an account is migrating to. Note that this will be reflected in the DID doc as provided and therefore should include the protocol scheme (`https://`). */
  pdsEndpoint?: string
  [k: string]: unknown
}

export interface OutputSchema {
  /** A signed DID PLC operation. */
  plcOp: {}
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
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

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
  email?: string
  /** Requested handle for the account. */
  handle: string
  /** Pre-existing atproto DID, being imported to a new account. */
  did?: string
  inviteCode?: string
  verificationCode?: string
  verificationPhone?: string
  /** Initial account password. May need to meet instance-specific password strength requirements. */
  password?: string
  /** DID PLC rotation key (aka, recovery key) to be included in PLC creation operation. */
  recoveryKey?: string
  /** A signed DID PLC operation to be submitted as part of importing an existing account to this instance. NOTE: this optional field may be updated when full account migration is implemented. */
  plcOp?: {}
  [k: string]: unknown
}

/** Account login session returned on successful account creation. */
export interface OutputSchema {
  accessJwt: string
  refreshJwt: string
  handle: string
  /** The DID of the new account. */
  did: string
  /** Complete DID document. */
  didDoc?: {}
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

export class InvalidHandleError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class InvalidPasswordError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class InvalidInviteCodeError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class HandleNotAvailableError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class UnsupportedDomainError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class UnresolvableDidError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class IncompatibleDidDocError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidHandle') return new InvalidHandleError(e)
    if (e.error === 'InvalidPassword') return new InvalidPasswordError(e)
    if (e.error === 'InvalidInviteCode') return new InvalidInviteCodeError(e)
    if (e.error === 'HandleNotAvailable') return new HandleNotAvailableError(e)
    if (e.error === 'UnsupportedDomain') return new UnsupportedDomainError(e)
    if (e.error === 'UnresolvableDid') return new UnresolvableDidError(e)
    if (e.error === 'IncompatibleDidDoc') return new IncompatibleDidDocError(e)
  }
  return e
}

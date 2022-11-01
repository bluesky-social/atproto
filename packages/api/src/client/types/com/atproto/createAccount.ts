/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
  encoding: 'application/json';
}

export interface InputSchema {
  email: string;
  username: string;
  inviteCode?: string;
  password: string;
  recoveryKey?: string;
}

export interface OutputSchema {
  accessJwt: string;
  refreshJwt: string;
  username: string;
  did: string;
}

export interface Response {
  success: boolean;
  headers: Headers;
  data: OutputSchema;
}

export class InvalidUsernameError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidPasswordError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidInviteCodeError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class UsernameNotAvailableError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidUsername') return new InvalidUsernameError(e)
    if (e.error === 'InvalidPassword') return new InvalidPasswordError(e)
    if (e.error === 'InvalidInviteCode') return new InvalidInviteCodeError(e)
    if (e.error === 'UsernameNotAvailable')
      return new UsernameNotAvailableError(e)
  }
  return e
}

/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
  encoding: 'application/json';
}

export interface InputSchema {
  username: string;
  did: string;
  password: string;
}

export interface OutputSchema {
  jwt: string;
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

export class UsernameNotAvailableError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidUsername') return new InvalidUsernameError(e)
    if (e.error === 'InvalidPassword') return new InvalidPasswordError(e)
    if (e.error === 'UsernameNotAvailable')
      return new UsernameNotAvailableError(e)
  }
  return e
}

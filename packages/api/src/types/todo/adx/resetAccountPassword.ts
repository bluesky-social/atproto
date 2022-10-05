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
  token: string;
  password: string;
}

export interface OutputSchema {}

export interface Response {
  success: boolean;
  headers: Headers;
  data: OutputSchema;
}

export class ExpiredTokenError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidTokenError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'ExpiredToken') return new ExpiredTokenError(e)
    if (e.error === 'InvalidToken') return new InvalidTokenError(e)
  }
  return e
}

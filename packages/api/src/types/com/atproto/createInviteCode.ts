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
  useCount: number;
}

export interface OutputSchema {
  code: string;
}

export interface Response {
  success: boolean;
  headers: Headers;
  data: OutputSchema;
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

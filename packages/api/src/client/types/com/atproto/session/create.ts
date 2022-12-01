/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface InputSchema {
  handle: string;
  password: string;
  [k: string]: unknown;
}

export interface OutputSchema {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
  [k: string]: unknown;
}

export interface CallOptions {
  headers?: Headers;
  qp?: QueryParams;
  encoding: 'application/json';
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

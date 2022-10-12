/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

export interface QueryParams {
  did: string;
  collection: string;
  recordKey: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface Response {
  success: boolean;
  headers: Headers;
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

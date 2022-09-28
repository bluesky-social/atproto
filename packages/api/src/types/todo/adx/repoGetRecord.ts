/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

export interface QueryParams {
  nameOrDid: string;
  type: string;
  tid: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string;
  value: {};
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

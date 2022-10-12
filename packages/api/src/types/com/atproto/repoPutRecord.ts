/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

export interface QueryParams {
  did: string;
  collection: string;
  rkey: string;
  validate?: boolean;
}

export interface CallOptions {
  headers?: Headers;
  encoding: 'application/json';
}

export interface InputSchema {
  [k: string]: unknown;
}

export interface OutputSchema {
  uri: string;
  cid: string;
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

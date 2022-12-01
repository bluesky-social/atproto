/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  user?: string;
  collection?: string;
  limit?: number;
  before?: string;
  after?: string;
  reverse?: boolean;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  records: Record[];
  [k: string]: unknown;
}

export interface CallOptions {
  headers?: Headers;
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

export interface Record {
  uri: string;
  cid: string;
  value: {};
  [k: string]: unknown;
}

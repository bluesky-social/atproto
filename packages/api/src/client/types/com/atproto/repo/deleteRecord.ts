/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string;
  /** The NSID of the record collection. */
  collection: string;
  /** The key of the record. */
  rkey: string;
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
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

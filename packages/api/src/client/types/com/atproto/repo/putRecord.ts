/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string;
  /** The NSID of the record type. */
  collection: string;
  /** The TID of the record. */
  rkey: string;
  /** Validate the record? */
  validate?: boolean;
  /** The record to create. */
  record: {};
  [k: string]: unknown;
}

export interface OutputSchema {
  uri: string;
  cid: string;
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
  qp?: QueryParams;
  encoding: 'application/json';
}

export interface InputSchema {
  /**
   * The DID of the repo.
   */
  did: string;
  /**
   * The NSID of the record collection.
   */
  collection: string;
  /**
   * Validate the record?
   */
  validate?: boolean;
  /**
   * The record to create.
   */
  record: {};
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  /**
   * The handle or DID of the repo.
   */
  user: string;
  /**
   * The NSID of the record type.
   */
  collection: string;
  /**
   * The number of records to return.
   */
  limit?: number;
  /**
   * A TID to filter the range of records returned.
   */
  before?: string;
  /**
   * A TID to filter the range of records returned.
   */
  after?: string;
  /**
   * Reverse the order of the returned records?
   */
  reverse?: boolean;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  records: {
    uri: string,
    cid: string,
    value: {},
  }[];
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

export interface QueryParams {
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  notifications: Notification[];
}
export interface Notification {
  uri: string;
  cid: string;
  author: {
    did: string,
    name: string,
    displayName?: string,
  };
  reason: string;
  reasonSubject?: string;
  record: {};
  isRead: boolean;
  indexedAt: string;
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

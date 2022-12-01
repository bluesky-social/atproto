/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  notifications: Notification[];
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

export interface Notification {
  uri: string;
  cid: string;
  author: Author;
  reason: string;
  reasonSubject?: string;
  record: {};
  isRead: boolean;
  indexedAt: string;
  [k: string]: unknown;
}

export interface Author {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface Declaration {
  cid: string;
  actorType: string;
  [k: string]: unknown;
}

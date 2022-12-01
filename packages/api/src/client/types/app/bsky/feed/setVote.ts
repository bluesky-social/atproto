/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface InputSchema {
  subject: Subject;
  direction: 'up' | 'down' | 'none';
  [k: string]: unknown;
}

export interface OutputSchema {
  upvote?: string;
  downvote?: string;
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

export interface Subject {
  uri: string;
  cid: string;
  [k: string]: unknown;
}

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
  subject: Subject;
  direction: 'up' | 'down' | 'none';
}
export interface Subject {
  uri: string;
  cid: string;
}

export interface OutputSchema {
  upvote?: string;
  downvote?: string;
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

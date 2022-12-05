/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  user: string;
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  subject: Subject;
  cursor?: string;
  followers: Follower[];
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

export interface Subject {
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface Follower {
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  handle: string;
  displayName?: string;
  createdAt?: string;
  indexedAt: string;
  [k: string]: unknown;
}

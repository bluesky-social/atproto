/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
  encoding: 'application/json';
}

export interface InputSchema {
  displayName?: string;
  description?: string;
  pinnedBadges?: AppBskyProfileBadgeRef[];
}
export interface AppBskyProfileBadgeRef {
  uri: string;
  cid: string;
}

export interface OutputSchema {
  uri: string;
  cid: string;
  record: {};
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  author?: string;
  subject?: string;
  assertion?: string;
  confirmed?: boolean;
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  assertions: Assertion[];
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

export interface Assertion {
  uri: string;
  cid: string;
  assertion: string;
  confirmation?: Confirmation;
  author: AppBskyActorRef.WithInfo;
  subject: AppBskyActorRef.WithInfo;
  indexedAt: string;
  createdAt: string;
  [k: string]: unknown;
}

export interface Confirmation {
  uri: string;
  cid: string;
  indexedAt: string;
  createdAt: string;
  [k: string]: unknown;
}

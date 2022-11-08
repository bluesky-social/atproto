/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  uri: string;
  cid?: string;
  direction?: string;
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string;
  cid?: string;
  cursor?: string;
  votes: {
    direction: 'up' | 'down',
    indexedAt: string,
    createdAt: string,
    actor: Actor,
  }[];
}
export interface Actor {
  did: string;
  handle: string;
  displayName?: string;
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

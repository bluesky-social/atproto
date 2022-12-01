/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  uri: string;
  cid?: string;
  direction?: 'up' | 'down';
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string;
  cid?: string;
  cursor?: string;
  votes: Vote[];
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

export interface Vote {
  direction: 'up' | 'down';
  indexedAt: string;
  createdAt: string;
  actor: Actor;
  [k: string]: unknown;
}

export interface Actor {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface Declaration {
  cid: string;
  actorType:
    | 'app.bsky.system.actorUser'
    | 'app.bsky.system.actorScene'
    | (string & {});
  [k: string]: unknown;
}

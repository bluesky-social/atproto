/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export type ActorKnown =
  | 'app.bsky.system.actorUser'
  | 'app.bsky.system.actorScene'
export type ActorUnknown = string

export interface OutputSchema {
  cursor?: string;
  notifications: Notification[];
}
export interface Notification {
  uri: string;
  cid: string;
  author: {
    did: string,
    declaration: Declaration,
    handle: string,
    displayName?: string,
  };
  reason: string;
  reasonSubject?: string;
  record: {};
  isRead: boolean;
  indexedAt: string;
}
export interface Declaration {
  cid: string;
  actorType: ActorKnown | ActorUnknown;
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

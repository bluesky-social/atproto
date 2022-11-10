/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  limit?: number;
  cursor?: string;
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
  actors: {
    did: string,
    declaration: Declaration,
    handle: string,
    displayName?: string,
    description?: string,
    indexedAt?: string,
    myState?: {
      follow?: string,
    },
  }[];
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  actor: string;
  assertion?: string;
  confirmed?: boolean;
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
  subject: {
    did: string,
    declaration: Declaration,
    handle: string,
    displayName?: string,
  };
  cursor?: string;
  assertions: {
    uri: string,
    cid: string,
    assertion: string,
    confirmation?: Confirmation,
    subject: Actor,
    indexedAt: string,
    createdAt: string,
  }[];
}
export interface Declaration {
  cid: string;
  actorType: ActorKnown | ActorUnknown;
}
export interface Confirmation {
  uri: string;
}
export interface Actor {
  did: string;
  declaration: Declaration;
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

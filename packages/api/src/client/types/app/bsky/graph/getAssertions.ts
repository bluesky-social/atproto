/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  author?: string;
  subject?: string;
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
  cursor?: string;
  assertions: {
    uri: string,
    cid: string,
    assertion: string,
    confirmation?: Confirmation,
    author: Actor,
    subject: Actor,
    indexedAt: string,
    createdAt: string,
  }[];
}
export interface Confirmation {
  uri: string;
  cid: string;
  indexedAt: string;
  createdAt: string;
}
export interface Actor {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
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

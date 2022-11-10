/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  actor: string;
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
  did: string;
  handle: string;
  actorType: ActorKnown | ActorUnknown;
  creator: string;
  displayName?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  membersCount: number;
  postsCount: number;
  myState?: {
    follow?: string,
    member?: string,
  };
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

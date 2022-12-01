/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  author: string;
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  feed: FeedItem[];
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

export interface FeedItem {
  uri: string;
  cid: string;
  author: Actor;
  trendedBy?: Actor;
  repostedBy?: Actor;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
  replyCount: number;
  repostCount: number;
  upvoteCount: number;
  downvoteCount: number;
  indexedAt: string;
  myState?: MyState;
  [k: string]: unknown;
}

export interface MyState {
  repost?: string;
  upvote?: string;
  downvote?: string;
  [k: string]: unknown;
}

export interface Actor {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface RecordEmbed {
  type: 'record';
  author: Actor;
  record: {};
  [k: string]: unknown;
}

export interface ExternalEmbed {
  type: 'external';
  uri: string;
  title: string;
  description: string;
  imageUri: string;
  [k: string]: unknown;
}

export interface UnknownEmbed {
  type: string;
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

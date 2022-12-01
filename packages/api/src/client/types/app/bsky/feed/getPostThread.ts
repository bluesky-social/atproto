/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  uri: string;
  depth?: number;
}

export type InputSchema = undefined

export interface OutputSchema {
  thread: Post | NotFoundPost;
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

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e)
  }
  return e
}

export interface Post {
  uri: string;
  cid: string;
  author: User;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
  parent?: Post | NotFoundPost;
  replyCount: number;
  replies?: (Post | NotFoundPost)[];
  repostCount: number;
  upvoteCount: number;
  downvoteCount: number;
  indexedAt: string;
  myState?: MyState;
  [k: string]: unknown;
}

export interface NotFoundPost {
  uri: string;
  notFound: boolean;
  [k: string]: unknown;
}

export interface MyState {
  repost?: string;
  upvote?: string;
  downvote?: string;
  [k: string]: unknown;
}

export interface User {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface RecordEmbed {
  type: 'record';
  author: User;
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

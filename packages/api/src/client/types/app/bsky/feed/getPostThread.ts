/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  uri: string;
  depth?: number;
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
  thread: Post | NotFoundPost;
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
  myState?: {
    repost?: string,
    upvote?: string,
    downvote?: string,
  };
}
export interface User {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
}
export interface Declaration {
  cid: string;
  actorType: ActorKnown | ActorUnknown;
}
export interface RecordEmbed {
  type: 'record';
  author: User;
  record: {};
}
export interface ExternalEmbed {
  type: 'external';
  uri: string;
  title: string;
  description: string;
  imageUri: string;
}
export interface UnknownEmbed {
  type: string;
}
export interface NotFoundPost {
  uri: string;
  notFound: boolean;
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

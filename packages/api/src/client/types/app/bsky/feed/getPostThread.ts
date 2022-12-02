/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyFeedEmbed from './embed'

export interface QueryParams {
  uri: string;
  depth?: number;
}

export type InputSchema = undefined

export interface OutputSchema {
  thread: Post | NotFoundPost | { $type: string, [k: string]: unknown };
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
  author: AppBskyActorRef.WithInfo;
  record: {};
  embed?: AppBskyFeedEmbed.Main;
  parent?: Post | NotFoundPost | { $type: string, [k: string]: unknown };
  replyCount: number;
  replies?: (Post | NotFoundPost | { $type: string, [k: string]: unknown })[];
  repostCount: number;
  upvoteCount: number;
  downvoteCount: number;
  indexedAt: string;
  myState?: MyState;
  [k: string]: unknown;
}

export interface NotFoundPost {
  uri: string;
  notFound: true;
  [k: string]: unknown;
}

export interface MyState {
  repost?: string;
  upvote?: string;
  downvote?: string;
  [k: string]: unknown;
}

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

export interface OutputSchema {
  thread: AppBskyGetPostThreadPost;
}
export interface AppBskyGetPostThreadPost {
  uri: string;
  cid: string;
  author: AppBskyGetPostThreadUser;
  record: {};
  embed?:
    | AppBskyGetPostThreadRecordEmbed
    | AppBskyGetPostThreadExternalEmbed
    | AppBskyGetPostThreadUnknownEmbed;
  parent?: AppBskyGetPostThreadPost;
  replyCount: number;
  replies?: AppBskyGetPostThreadPost[];
  likeCount: number;
  repostCount: number;
  indexedAt: string;
  myState?: {
    repost?: string,
    like?: string,
  };
}
export interface AppBskyGetPostThreadUser {
  did: string;
  name: string;
  displayName?: string;
}
export interface AppBskyGetPostThreadRecordEmbed {
  type: 'record';
  author: AppBskyGetPostThreadUser;
  record: {};
}
export interface AppBskyGetPostThreadExternalEmbed {
  type: 'external';
  uri: string;
  title: string;
  description: string;
  imageUri: string;
}
export interface AppBskyGetPostThreadUnknownEmbed {
  type: string;
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

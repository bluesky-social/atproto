/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  author: string;
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  feed: AppBskyGetAuthorFeedFeedItem[];
}
export interface AppBskyGetAuthorFeedFeedItem {
  uri: string;
  cid: string;
  author: AppBskyGetAuthorFeedUser;
  repostedBy?: AppBskyGetAuthorFeedUser;
  record: {};
  embed?:
    | AppBskyGetAuthorFeedRecordEmbed
    | AppBskyGetAuthorFeedExternalEmbed
    | AppBskyGetAuthorFeedUnknownEmbed;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
  myState?: {
    repost?: string,
    like?: string,
  };
}
export interface AppBskyGetAuthorFeedUser {
  did: string;
  name: string;
  displayName?: string;
}
export interface AppBskyGetAuthorFeedRecordEmbed {
  type: 'record';
  author: AppBskyGetAuthorFeedUser;
  record: {};
}
export interface AppBskyGetAuthorFeedExternalEmbed {
  type: 'external';
  uri: string;
  title: string;
  description: string;
  imageUri: string;
}
export interface AppBskyGetAuthorFeedUnknownEmbed {
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

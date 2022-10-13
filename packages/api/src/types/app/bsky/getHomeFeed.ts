/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

export interface QueryParams {
  algorithm?: string;
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  feed: AppBskyGetHomeFeedFeedItem[];
}
export interface AppBskyGetHomeFeedFeedItem {
  cursor: string;
  uri: string;
  cid: string;
  author: AppBskyGetHomeFeedUser;
  repostedBy?: AppBskyGetHomeFeedUser;
  record: {};
  embed?:
    | AppBskyGetHomeFeedRecordEmbed
    | AppBskyGetHomeFeedExternalEmbed
    | AppBskyGetHomeFeedUnknownEmbed;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
  myState?: {
    repost?: string,
    like?: string,
  };
}
export interface AppBskyGetHomeFeedUser {
  did: string;
  name: string;
  displayName?: string;
}
export interface AppBskyGetHomeFeedRecordEmbed {
  type: 'record';
  author: AppBskyGetHomeFeedUser;
  record: {};
}
export interface AppBskyGetHomeFeedExternalEmbed {
  type: 'external';
  uri: string;
  title: string;
  description: string;
  imageUri: string;
}
export interface AppBskyGetHomeFeedUnknownEmbed {
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

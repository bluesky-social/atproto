/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  author: string;
  limit?: number;
  before?: string;
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface HandlerError {
  status: number;
  message?: string;
}

export type HandlerOutput = HandlerError | HandlerSuccess

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

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

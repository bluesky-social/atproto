/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  algorithm?: string;
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
  feed: AppBskyGetHomeFeedFeedItem[];
}
export interface AppBskyGetHomeFeedFeedItem {
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

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

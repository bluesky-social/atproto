/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyFeedEmbed from './embed'

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
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

export interface FeedItem {
  uri: string;
  cid: string;
  author: AppBskyActorRef.WithInfo;
  trendedBy?: AppBskyActorRef.WithInfo;
  repostedBy?: AppBskyActorRef.WithInfo;
  record: {};
  embed?: AppBskyFeedEmbed.Main;
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyFeedEmbed from './embed'

export interface QueryParams {
  uri: string;
  depth?: number;
}

export type InputSchema = undefined

export interface OutputSchema {
  thread: Post | NotFoundPost;
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
  error?: 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

export interface Post {
  uri: string;
  cid: string;
  author: AppBskyActorRef.WithInfo;
  record: {};
  embed?: AppBskyFeedEmbed.Main;
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  algorithm?: string;
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
  author: Actor;
  trendedBy?: Actor;
  repostedBy?: Actor;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
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

export interface Actor {
  did: string;
  declaration: Declaration;
  handle: string;
  actorType?: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface RecordEmbed {
  type: 'record';
  author: Actor;
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

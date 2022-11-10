/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  uri: string;
  depth?: number;
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

export type ActorKnown =
  | 'app.bsky.system.actorUser'
  | 'app.bsky.system.actorScene'
export type ActorUnknown = string

export interface OutputSchema {
  thread: Post;
}
export interface Post {
  uri: string;
  cid: string;
  author: User;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
  parent?: Post;
  replyCount: number;
  replies?: Post[];
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

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

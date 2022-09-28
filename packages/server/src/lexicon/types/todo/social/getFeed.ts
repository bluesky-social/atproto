/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  author?: string;
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
  feed: FeedItem[];
}
export interface FeedItem {
  cursor?: string;
  uri: string;
  author: User;
  repostedBy?: User;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
  myState?: {
    repost?: string,
    like?: string,
  };
}
export interface User {
  did: string;
  name: string;
  displayName?: string;
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

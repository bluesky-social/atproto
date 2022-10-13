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

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

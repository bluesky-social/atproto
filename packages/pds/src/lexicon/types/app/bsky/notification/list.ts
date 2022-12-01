/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  notifications: Notification[];
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

export interface Notification {
  uri: string;
  cid: string;
  author: Author;
  /** Expected values are 'vote', 'repost', 'trend', 'follow', 'invite', 'mention' and 'reply'. */
  reason: string;
  reasonSubject?: string;
  record: {};
  isRead: boolean;
  indexedAt: string;
  [k: string]: unknown;
}

export interface Author {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
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

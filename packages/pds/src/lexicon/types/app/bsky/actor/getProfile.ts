/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  actor: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  did: string;
  declaration: Declaration;
  handle: string;
  creator: string;
  displayName?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  membersCount: number;
  postsCount: number;
  myState?: MyState;
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

export interface MyState {
  follow?: string;
  member?: string;
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  term: string;
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  users: User[];
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

export interface User {
  did: string;
  declaration: Declaration;
  handle: string;
  displayName?: string;
  description?: string;
  indexedAt?: string;
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  uri: string;
  cid?: string;
  direction?: 'up' | 'down';
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string;
  cid?: string;
  cursor?: string;
  votes: Vote[];
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

export interface Vote {
  direction: 'up' | 'down';
  indexedAt: string;
  createdAt: string;
  actor: Actor;
  [k: string]: unknown;
}

export interface Actor {
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

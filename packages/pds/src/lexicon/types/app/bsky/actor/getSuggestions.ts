/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  limit?: number;
  cursor?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  actors: Actor[];
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

export interface Actor {
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  handle: string;
  displayName?: string;
  description?: string;
  indexedAt?: string;
  myState?: MyState;
  [k: string]: unknown;
}

export interface MyState {
  follow?: string;
  [k: string]: unknown;
}

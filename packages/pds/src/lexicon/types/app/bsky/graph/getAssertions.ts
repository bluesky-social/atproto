/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  author?: string;
  subject?: string;
  assertion?: string;
  confirmed?: boolean;
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  assertions: Assertion[];
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

export interface Assertion {
  uri: string;
  cid: string;
  assertion: string;
  confirmation?: Confirmation;
  author: AppBskyActorRef.Main;
  subject: AppBskyActorRef.Main;
  indexedAt: string;
  createdAt: string;
  [k: string]: unknown;
}

export interface Confirmation {
  uri: string;
  cid: string;
  indexedAt: string;
  createdAt: string;
  [k: string]: unknown;
}

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  uri: string;
  cid?: string;
  direction?: 'up' | 'down';
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
  uri: string;
  cid?: string;
  cursor?: string;
  votes: {
    direction: 'up' | 'down',
    indexedAt: string,
    createdAt: string,
    actor: Actor,
  }[];
}
export interface Actor {
  did: string;
  handle: string;
  displayName?: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

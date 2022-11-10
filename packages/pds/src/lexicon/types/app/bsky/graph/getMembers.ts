/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  actor: string;
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
  subject: {
    did: string,
    handle: string,
    displayName?: string,
  };
  cursor?: string;
  members: {
    did: string,
    handle: string,
    displayName?: string,
    declaration: {
      cid: string,
      actorType: string,
    },
    createdAt?: string,
    indexedAt: string,
  }[];
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

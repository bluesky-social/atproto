/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  uri: string;
  cid?: string;
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
  repostedBy: {
    did: string,
    handle: string,
    displayName?: string,
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

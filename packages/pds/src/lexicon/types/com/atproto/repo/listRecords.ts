/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  user?: string;
  collection?: string;
  limit?: number;
  before?: string;
  after?: string;
  reverse?: boolean;
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string;
  records: Record[];
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

export interface Record {
  uri: string;
  cid: string;
  value: {};
  [k: string]: unknown;
}

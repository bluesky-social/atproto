/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export interface InputSchema {
  subject: Subject;
  direction: 'up' | 'down' | 'none';
  [k: string]: unknown;
}

export interface OutputSchema {
  upvote?: string;
  downvote?: string;
  [k: string]: unknown;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

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

export interface Subject {
  uri: string;
  cid: string;
  [k: string]: unknown;
}

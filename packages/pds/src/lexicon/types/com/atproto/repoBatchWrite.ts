/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  did: string;
  validate?: boolean;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface InputSchema {
  writes: (
    | {
        action: 'create',
        collection: string,
        rkey?: string,
        value: unknown,
      }
    | {
        action: 'update',
        collection: string,
        rkey: string,
        value: unknown,
      }
    | {
        action: 'delete',
        collection: string,
        rkey: string,
      }
  )[];
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

export interface OutputSchema {
  [k: string]: unknown;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

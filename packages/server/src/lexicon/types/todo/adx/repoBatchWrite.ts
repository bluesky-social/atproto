/**
* GENERATED CODE - DO NOT MODIFY
* Created Wed Sep 21 2022
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
        value: unknown,
      }
    | {
        action: 'update',
        collection: string,
        tid: string,
        value: unknown,
      }
    | {
        action: 'delete',
        collection: string,
        tid: string,
      }
  )[];
}

export interface HandlerOutput {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface OutputSchema {
  [k: string]: unknown;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

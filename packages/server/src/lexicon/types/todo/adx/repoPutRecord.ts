/**
* GENERATED CODE - DO NOT MODIFY
* Created Thu Sep 22 2022
*/
import express from 'express'

export interface QueryParams {
  did: string;
  type: string;
  tid: string;
  validate?: boolean;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface InputSchema {
  [k: string]: unknown;
}

export interface HandlerOutput {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface OutputSchema {
  uri: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

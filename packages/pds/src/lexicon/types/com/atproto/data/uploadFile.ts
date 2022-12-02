/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export type InputSchema = string | Uint8Array

export interface OutputSchema {
  cid: string;
  [k: string]: unknown;
}

export interface HandlerInput {
  encoding: '*/*';
  body: Uint8Array;
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

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  did: string;
  from?: string;
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/cbor';
  body: Uint8Array;
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

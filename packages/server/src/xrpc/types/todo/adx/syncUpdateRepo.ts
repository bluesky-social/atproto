/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import express from 'express'

export interface QueryParams {
  did: string;
}

export interface HandlerInput {
  encoding: 'application/cbor';
  body: Uint8Array;
}

export type HandlerOutput = void
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

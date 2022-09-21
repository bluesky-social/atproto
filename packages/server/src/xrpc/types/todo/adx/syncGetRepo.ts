/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import express from 'express'

export interface QueryParams {
  did: string;
  from?: string;
}

export type HandlerInput = undefined

export interface HandlerOutput {
  encoding: 'application/cbor';
  body: Uint8Array;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

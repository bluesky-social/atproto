/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  /** The DID of the repo. */
  did: string;
}

export type InputSchema = string | Uint8Array

export interface HandlerInput {
  encoding: 'application/cbor';
  body: Uint8Array;
}

export interface HandlerError {
  status: number;
  message?: string;
}

export type HandlerOutput = HandlerError | void
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  /**
   * The handle or DID of the repo.
   */
  user: string;
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

export interface OutputSchema {
  handle: string;
  did: string;
  didDoc: {};
  collections: string[];
  handleIsCorrect: boolean;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

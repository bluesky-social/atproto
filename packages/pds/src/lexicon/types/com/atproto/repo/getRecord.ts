/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  /**
   * The handle or DID of the repo.
   */
  user: string;
  /**
   * The NSID of the collection.
   */
  collection: string;
  /**
   * The key of the record.
   */
  rkey: string;
  /**
   * The CID of the version of the record. If not specified, then return the most recent version.
   */
  cid?: string;
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
  uri: string;
  cid?: string;
  value: {};
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

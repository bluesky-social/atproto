/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface InputSchema {
  /**
   * The DID of the repo.
   */
  did: string;
  /**
   * The NSID of the record type.
   */
  collection: string;
  /**
   * The TID of the record.
   */
  rkey: string;
  /**
   * Validate the record?
   */
  validate?: boolean;
  /**
   * The record to create
   */
  record: {};
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
  uri: string;
  cid: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

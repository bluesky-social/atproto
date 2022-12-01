/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string;
  /** Validate the records? */
  validate?: boolean;
  writes: (Create | Update | Delete)[];
  [k: string]: unknown;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
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

export interface Create {
  action: 'create';
  collection: string;
  rkey?: string;
  value: {};
  [k: string]: unknown;
}

export interface Update {
  action: 'update';
  collection: string;
  rkey: string;
  value: {};
  [k: string]: unknown;
}

export interface Delete {
  action: 'delete';
  collection: string;
  rkey: string;
  [k: string]: unknown;
}

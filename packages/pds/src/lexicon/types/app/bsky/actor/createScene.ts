/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {}

export interface InputSchema {
  handle: string;
  recoveryKey?: string;
  [k: string]: unknown;
}

export interface OutputSchema {
  handle: string;
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  [k: string]: unknown;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'InvalidHandle' | 'HandleNotAvailable';
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

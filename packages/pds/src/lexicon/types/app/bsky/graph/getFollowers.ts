/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  user: string;
  limit?: number;
  before?: string;
}

export type InputSchema = undefined

export interface OutputSchema {
  subject: Subject;
  cursor?: string;
  followers: Follower[];
  [k: string]: unknown;
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
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

export interface Subject {
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  handle: string;
  displayName?: string;
  [k: string]: unknown;
}

export interface Follower {
  did: string;
  declaration: AppBskySystemDeclRef.Main;
  handle: string;
  displayName?: string;
  createdAt?: string;
  indexedAt: string;
  [k: string]: unknown;
}

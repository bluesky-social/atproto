/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
  user: string;
}

export type HandlerInput = undefined

export interface HandlerOutput {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface OutputSchema {
  did: string;
  name: string;
  displayName?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  badges: Badge[];
  myState?: {
    follow?: string,
  };
}
export interface Badge {
  uri: string;
  error?: string;
  issuer?: {
    did: string,
    name: string,
    displayName: string,
  };
  assertion?: {
    type: string,
  };
  createdAt?: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

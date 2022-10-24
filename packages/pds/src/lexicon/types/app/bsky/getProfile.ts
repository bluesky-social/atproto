/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {
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
  did: string;
  name: string;
  displayName?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  pinnedBadges: AppBskyGetProfileBadge[];
  myState?: {
    follow?: string,
  };
}
export interface AppBskyGetProfileBadge {
  uri: string;
  cid: string;
  error?: string;
  issuer?: {
    did: string,
    name: string,
    displayName?: string,
  };
  assertion?: {
    type: string,
    tag?: string,
  };
  createdAt?: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput

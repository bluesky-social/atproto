/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  user: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

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

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

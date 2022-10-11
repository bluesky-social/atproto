/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@adxp/xrpc'

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
  cid: string;
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
  headers: Headers;
  data: OutputSchema;
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

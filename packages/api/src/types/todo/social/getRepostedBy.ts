/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  uri: string;
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string;
  repostedBy: {
    did: string,
    name: string,
    displayName?: string,
    createdAt?: string,
    indexedAt: string,
  }[];
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

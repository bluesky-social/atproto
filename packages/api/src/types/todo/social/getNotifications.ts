/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  notifications: Notification[];
}
export interface Notification {
  uri: string;
  author: {
    did: string,
    name: string,
    displayName: string,
  };
  record: {};
  isRead: boolean;
  indexedAt: string;
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

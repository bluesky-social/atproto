/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  nameOrDid: string;
  type: string;
  limit?: number;
  before?: string;
  after?: string;
  reverse?: boolean;
}

export interface CallOptions {
  headers?: Headers;
}

export interface OutputSchema {
  records: {
    uri: string,
    value: {},
  }[];
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

/**
* GENERATED CODE - DO NOT MODIFY
* Created Wed Sep 21 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  name?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  did: string;
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

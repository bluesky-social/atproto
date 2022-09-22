/**
* GENERATED CODE - DO NOT MODIFY
* Created Wed Sep 21 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  did: string;
  from?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: Uint8Array;
}

/**
* GENERATED CODE - DO NOT MODIFY
* Created Thu Sep 22 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  did: string;
  type: string;
  tid: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
}

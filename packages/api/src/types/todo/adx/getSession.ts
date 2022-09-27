/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 27 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  name: string;
  did: string;
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

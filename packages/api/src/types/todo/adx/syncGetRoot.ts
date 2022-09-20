/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {
  did: string;
}

export interface CallOptions {
  headers?: Headers;
}

export interface OutputSchema {
  root: string;
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
  encoding: 'application/json';
  data: InputSchema;
}

export interface InputSchema {
  username: string;
  did: string;
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
}

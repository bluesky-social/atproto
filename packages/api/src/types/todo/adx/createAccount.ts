/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers } from '@adxp/xrpc'

export interface QueryParams {}

export interface CallOptions {
  headers?: Headers;
  encoding: 'application/json';
}

export interface InputSchema {
  email: string;
  username: string;
  inviteCode?: string;
  password: string;
}

export interface OutputSchema {
  jwt: string;
  username: string;
  did: string;
}

export interface Response {
  success: boolean;
  error: boolean;
  headers: Headers;
  data: OutputSchema;
}

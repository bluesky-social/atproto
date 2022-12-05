/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string;
  /** Validate the records? */
  validate?: boolean;
  writes: (Create | Update | Delete)[];
  [k: string]: unknown;
}

export interface CallOptions {
  headers?: Headers;
  qp?: QueryParams;
  encoding: 'application/json';
}

export interface Response {
  success: boolean;
  headers: Headers;
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface Create {
  action: 'create';
  collection: string;
  rkey?: string;
  value: {};
  [k: string]: unknown;
}

export interface Update {
  action: 'update';
  collection: string;
  rkey: string;
  value: {};
  [k: string]: unknown;
}

export interface Delete {
  action: 'delete';
  collection: string;
  rkey: string;
  [k: string]: unknown;
}

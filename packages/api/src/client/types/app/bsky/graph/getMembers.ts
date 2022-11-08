/**
* GENERATED CODE - DO NOT MODIFY
*/
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {
  actor: string;
  limit?: number;
  before?: string;
}

export interface CallOptions {
  headers?: Headers;
}

export type InputSchema = undefined

export interface OutputSchema {
  subject: {
    did: string,
    handle: string,
    displayName?: string,
  };
  cursor?: string;
  members: {
    did: string,
    handle: string,
    displayName?: string,
    declaration: {
      cid: string,
      actorType: string,
    },
    createdAt?: string,
    indexedAt: string,
  }[];
}

export interface Response {
  success: boolean;
  headers: Headers;
  data: OutputSchema;
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

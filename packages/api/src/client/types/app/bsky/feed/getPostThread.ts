/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskyFeedPost from './post'

export interface QueryParams {
  uri: string
  depth?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  thread:
    | ThreadViewPost
    | NotFoundPost
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e)
  }
  return e
}

export interface ThreadViewPost {
  post: AppBskyFeedPost.View
  parent?:
    | ThreadViewPost
    | NotFoundPost
    | { $type: string; [k: string]: unknown }
  replies?: (
    | ThreadViewPost
    | NotFoundPost
    | { $type: string; [k: string]: unknown }
  )[]
  [k: string]: unknown
}

export interface NotFoundPost {
  uri: string
  notFound: true
  [k: string]: unknown
}

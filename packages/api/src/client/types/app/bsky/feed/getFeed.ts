/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyFeedDefs from './defs'

export interface QueryParams {
  feed: string
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  feed: AppBskyFeedDefs.FeedViewPost[]
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

export class UnknownFeedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class FeedUnavailableError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class FeedNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidFeedResponseError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidFeedConfigError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export enum ErrorName {
  UnknownFeed = 'UnknownFeed',
  FeedUnavailable = 'FeedUnavailable',
  FeedNotFound = 'FeedNotFound',
  InvalidFeedResponse = 'InvalidFeedResponse',
  InvalidFeedConfig = 'InvalidFeedConfig',
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === ErrorName.UnknownFeed) return new UnknownFeedError(e)
    if (e.error === ErrorName.FeedUnavailable)
      return new FeedUnavailableError(e)
    if (e.error === ErrorName.FeedNotFound) return new FeedNotFoundError(e)
    if (e.error === ErrorName.InvalidFeedResponse)
      return new InvalidFeedResponseError(e)
    if (e.error === ErrorName.InvalidFeedConfig)
      return new InvalidFeedConfigError(e)
  }
  return e
}

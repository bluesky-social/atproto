/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
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

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'NotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

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

export function isThreadViewPost(v: unknown): v is ThreadViewPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.getPostThread#threadViewPost'
  )
}

export function validateThreadViewPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getPostThread#threadViewPost', v)
}

export interface NotFoundPost {
  uri: string
  notFound: true
  [k: string]: unknown
}

export function isNotFoundPost(v: unknown): v is NotFoundPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.getPostThread#notFoundPost'
  )
}

export function validateNotFoundPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getPostThread#notFoundPost', v)
}

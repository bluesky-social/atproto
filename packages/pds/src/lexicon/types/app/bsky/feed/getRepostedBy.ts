/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  uri: string
  cid?: string
  limit: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  repostedBy: RepostedBy[]
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
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

export interface RepostedBy {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  avatar?: string
  createdAt?: string
  indexedAt: string
  [k: string]: unknown
}

export function isRepostedBy(v: unknown): v is RepostedBy {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.getRepostedBy#repostedBy'
  )
}

export function validateRepostedBy(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getRepostedBy#repostedBy', v)
}

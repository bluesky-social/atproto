/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  uri: string
  cid?: string
  direction?: 'up' | 'down'
  limit: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  votes: Vote[]
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

export interface Vote {
  direction: 'up' | 'down'
  indexedAt: string
  createdAt: string
  actor: AppBskyActorRef.WithInfo
  [k: string]: unknown
}

export function isVote(v: unknown): v is Vote {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.getVotes#vote'
  )
}

export function validateVote(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getVotes#vote', v)
}

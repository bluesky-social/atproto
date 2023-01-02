/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  user: string
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  subject: AppBskyActorRef.WithInfo
  cursor?: string
  followers: Follower[]
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

export interface Follower {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  avatar?: string
  createdAt?: string
  indexedAt: string
  [k: string]: unknown
}

export function isFollower(v: unknown): v is Follower {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getFollowers#follower'
  )
}

export function validateFollower(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getFollowers#follower', v)
}

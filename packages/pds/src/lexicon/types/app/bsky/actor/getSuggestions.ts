/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  actors: Actor[]
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

export interface Actor {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  indexedAt?: string
  [k: string]: unknown
}

<<<<<<< HEAD
export interface MyState {
  follow?: string
  [k: string]: unknown
=======
export function isActor(v: unknown): v is Actor {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.getSuggestions#actor'
  )
}

export function validateActor(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.getSuggestions#actor', v)
>>>>>>> e8b8d081aefbd480e2a30d74fcba203635a37c93
}

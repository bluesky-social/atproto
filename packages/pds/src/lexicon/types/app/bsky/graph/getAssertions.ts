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
  author?: string
  subject?: string
  assertion?: string
  confirmed?: boolean
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  assertions: Assertion[]
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

export interface Assertion {
  uri: string
  cid: string
  assertion: string
  confirmation?: Confirmation
  author: AppBskyActorRef.WithInfo
  subject: AppBskyActorRef.WithInfo
  indexedAt: string
  createdAt: string
  [k: string]: unknown
}

export function isAssertion(v: unknown): v is Assertion {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getAssertions#assertion'
  )
}

export function validateAssertion(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getAssertions#assertion', v)
}

export interface Confirmation {
  uri: string
  cid: string
  indexedAt: string
  createdAt: string
  [k: string]: unknown
}

export function isConfirmation(v: unknown): v is Confirmation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getAssertions#confirmation'
  )
}

export function validateConfirmation(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getAssertions#confirmation', v)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {
  includeUsed: boolean
  createAvailable: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  codes: Invite[]
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
  error?: 'DuplicateCreate'
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

export interface Invite {
  code: string
  available: number
  uses: number
  [k: string]: unknown
}

export function isInvite(v: unknown): v is Invite {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.getUserInviteCodes#invite'
  )
}

export function validateInvite(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.server.getUserInviteCodes#invite', v)
}

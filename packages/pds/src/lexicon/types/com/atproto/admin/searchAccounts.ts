/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export interface QueryParams {
  email?: string
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  accounts: AccountSearchResult[]
  [k: string]: unknown
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface AccountSearchResult {
  did: string
  email: string
  normalizedEmail?: string
  handle?: string
  [k: string]: unknown
}

export function isAccountSearchResult(v: unknown): v is AccountSearchResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.searchAccounts#accountSearchResult'
  )
}

export function validateAccountSearchResult(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.admin.searchAccounts#accountSearchResult',
    v,
  )
}

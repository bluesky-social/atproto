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
  codes: CodeDetail[]
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

export interface CodeDetail {
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: CodeUse[]
  [k: string]: unknown
}

export function isCodeDetail(v: unknown): v is CodeDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.getAccountInviteCodes#codeDetail'
  )
}

export function validateCodeDetail(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.server.getAccountInviteCodes#codeDetail',
    v,
  )
}

export interface CodeUse {
  usedBy: string
  usedAt: string
  [k: string]: unknown
}

export function isCodeUse(v: unknown): v is CodeUse {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.getAccountInviteCodes#codeUse'
  )
}

export function validateCodeUse(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.server.getAccountInviteCodes#codeUse',
    v,
  )
}

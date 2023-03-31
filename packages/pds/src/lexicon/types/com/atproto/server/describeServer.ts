/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  inviteCodeRequired?: boolean
  availableUserDomains: string[]
  links?: Links
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

export interface Links {
  privacyPolicy?: string
  termsOfService?: string
  [k: string]: unknown
}

export function isLinks(v: unknown): v is Links {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.describeServer#links'
  )
}

export function validateLinks(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.server.describeServer#links', v)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {
  /** The handle or DID of the repo. */
  user: string
  /** The NSID of the collection. */
  collection: string
  /** The key of the record. */
  rkey: string
  /** The CID of the version of the record. If not specified, then return the most recent version. */
  cid?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  value: {}
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

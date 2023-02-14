/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string
  /** The NSID of the record type. */
  collection: string
  /** The TID of the record. */
  rkey: string
  /** Validate the record? */
  validate: boolean
  /** The record to create. */
  record: {}
  [k: string]: unknown
}

export interface OutputSchema {
  uri: string
  cid: string
  [k: string]: unknown
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

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

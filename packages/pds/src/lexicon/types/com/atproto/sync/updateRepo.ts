/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import stream from 'stream'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {
  /** The DID of the repo. */
  did: string
}

export type InputSchema = string | Uint8Array

export interface HandlerInput {
  encoding: 'application/cbor'
  body: stream.Readable
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | void
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

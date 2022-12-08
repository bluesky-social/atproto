/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import stream from 'stream'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {
  /** The DID of the repo. */
  did: string
  /** A past commit CID. */
  from?: string
}

export type InputSchema = undefined
export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/cbor'
  body: Uint8Array | stream.Readable
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

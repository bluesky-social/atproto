/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {
  /** The handle or DID of the repo. */
  user: string
  /** The NSID of the record type. */
  collection: string
  /** The number of records to return. */
  limit?: number
  /** A TID to filter the range of records returned. */
  before?: string
  /** A TID to filter the range of records returned. */
  after?: string
  /** Reverse the order of the returned records? */
  reverse?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  records: Record[]
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

export interface Record {
  uri: string
  cid: string
  value: {}
  [k: string]: unknown
}

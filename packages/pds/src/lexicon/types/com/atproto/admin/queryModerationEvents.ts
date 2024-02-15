/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ComAtprotoAdminDefs from './defs'

export interface QueryParams {
  /** The types of events (fully qualified string in the format of com.atproto.admin#modEvent<name>) to filter by. If not specified, all events are returned. */
  types?: string[]
  createdBy?: string
  /** Sort direction for the events. Defaults to descending order of created at timestamp. */
  sortDirection: 'asc' | 'desc'
  /** Retrieve events created after a given timestamp */
  createdAfter?: string
  /** Retrieve events created before a given timestamp */
  createdBefore?: string
  subject?: string
  /** If true, events on all record types (posts, lists, profile etc.) owned by the did are returned */
  includeAllUserRecords: boolean
  limit: number
  /** If true, only events with comments are returned */
  hasComment?: boolean
  /** If specified, only events with comments containing the keyword are returned */
  comment?: string
  /** If specified, only events where all of these labels were added are returned */
  addedLabels?: string[]
  /** If specified, only events where all of these labels were removed are returned */
  removedLabels?: string[]
  reportTypes?: string[]
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  events: ComAtprotoAdminDefs.ModEventView[]
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

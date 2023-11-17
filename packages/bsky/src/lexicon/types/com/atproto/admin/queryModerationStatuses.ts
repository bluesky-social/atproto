/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as ComAtprotoAdminDefs from './defs'

export interface QueryParams {
  subject?: string
  /** Search subjects by keyword from comments */
  comment?: string
  /** Search subjects reported after a given timestamp */
  reportedAfter?: string
  /** Search subjects reported before a given timestamp */
  reportedBefore?: string
  /** Search subjects reviewed after a given timestamp */
  reviewedAfter?: string
  /** Search subjects reviewed before a given timestamp */
  reviewedBefore?: string
  /** By default, we don't include muted subjects in the results. Set this to true to include them. */
  includeMuted?: boolean
  /** Specify when fetching subjects in a certain state */
  reviewState?: string
  ignoreSubjects?: string[]
  /** Get all subject statuses that were reviewed by a specific moderator */
  lastReviewedBy?: string
  sortField: 'lastReviewedAt' | 'lastReportedAt'
  sortDirection: 'asc' | 'desc'
  /** Get subjects that were taken down */
  takendown?: boolean
  limit: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  subjectStatuses: ComAtprotoAdminDefs.SubjectStatusView[]
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

export type HandlerOutput = HandlerError | HandlerSuccess
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

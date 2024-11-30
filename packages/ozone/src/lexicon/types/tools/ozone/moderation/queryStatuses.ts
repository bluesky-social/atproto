/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ToolsOzoneModerationDefs from './defs'

export interface QueryParams {
  /** All subjects, or subjects from given 'collections' param, belonging to the account specified in the 'subject' param will be returned. */
  includeAllUserRecords?: boolean
  /** The subject to get the status for. */
  subject?: string
  /** Search subjects by keyword from comments */
  comment?: string
  /** Search subjects reported after a given timestamp */
  reportedAfter?: string
  /** Search subjects reported before a given timestamp */
  reportedBefore?: string
  /** Search subjects reviewed after a given timestamp */
  reviewedAfter?: string
  /** Search subjects where the associated record/account was deleted after a given timestamp */
  hostingDeletedAfter?: string
  /** Search subjects where the associated record/account was deleted before a given timestamp */
  hostingDeletedBefore?: string
  /** Search subjects where the associated record/account was updated after a given timestamp */
  hostingUpdatedAfter?: string
  /** Search subjects where the associated record/account was updated before a given timestamp */
  hostingUpdatedBefore?: string
  /** Search subjects by the status of the associated record/account */
  hostingStatuses?: string[]
  /** Search subjects reviewed before a given timestamp */
  reviewedBefore?: string
  /** By default, we don't include muted subjects in the results. Set this to true to include them. */
  includeMuted?: boolean
  /** When set to true, only muted subjects and reporters will be returned. */
  onlyMuted?: boolean
  /** Specify when fetching subjects in a certain state */
  reviewState?: string
  ignoreSubjects?: string[]
  /** Get all subject statuses that were reviewed by a specific moderator */
  lastReviewedBy?: string
  sortField: 'lastReviewedAt' | 'lastReportedAt'
  sortDirection: 'asc' | 'desc'
  /** Get subjects that were taken down */
  takendown?: boolean
  /** Get subjects in unresolved appealed status */
  appealed?: boolean
  limit: number
  tags?: string[]
  excludeTags?: string[]
  cursor?: string
  /** If specified, subjects belonging to the given collections will be returned. When subjectType is set to 'account', this will be ignored. */
  collections?: string[]
  /** If specified, subjects of the given type (account or record) will be returned. When this is set to 'account' the 'collections' parameter will be ignored. When includeAllUserRecords or subject is set, this will be ignored. */
  subjectType?: 'account' | 'record' | (string & {})
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  subjectStatuses: ToolsOzoneModerationDefs.SubjectStatusView[]
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

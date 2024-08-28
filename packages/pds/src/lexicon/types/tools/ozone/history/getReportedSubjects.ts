/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ToolsOzoneHistoryDefs from './defs'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'

export interface QueryParams {
  account?: string
  limit: number
  sortDirection: 'asc' | 'desc' | (string & {})
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  subjects: ReportView[]
  cursor?: string
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

export interface ReportView {
  subject: ToolsOzoneHistoryDefs.SubjectBasicView
  report: Report
  [k: string]: unknown
}

export function isReportView(v: unknown): v is ReportView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.getReportedSubjects#reportView'
  )
}

export function validateReportView(v: unknown): ValidationResult {
  return lexicons.validate(
    'tools.ozone.history.getReportedSubjects#reportView',
    v,
  )
}

export interface Report {
  reasonType: ComAtprotoModerationDefs.ReasonType
  reason: string
  createdAt: string
  [k: string]: unknown
}

export function isReport(v: unknown): v is Report {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.getReportedSubjects#report'
  )
}

export function validateReport(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.getReportedSubjects#report', v)
}

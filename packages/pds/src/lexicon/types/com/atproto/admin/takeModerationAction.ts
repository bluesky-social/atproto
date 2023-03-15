/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as ComAtprotoAdminDef from './def'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  action:
    | 'com.atproto.admin.def#takedown'
    | 'com.atproto.admin.def#flag'
    | 'com.atproto.admin.def#acknowledge'
    | (string & {})
  subject:
    | ComAtprotoAdminDef.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  reason: string
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminDef.ActionView

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
  error?: 'SubjectHasAction'
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

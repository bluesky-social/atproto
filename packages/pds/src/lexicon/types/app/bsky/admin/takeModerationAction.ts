/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyAdminModerationAction from './moderationAction'

export interface QueryParams {}

export interface InputSchema {
  action: 'app.bsky.admin.actionTakedown' | (string & {})
  subject: AppBskyActorRef.Main | { $type: string; [k: string]: unknown }
  reason: string
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = AppBskyAdminModerationAction.View

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

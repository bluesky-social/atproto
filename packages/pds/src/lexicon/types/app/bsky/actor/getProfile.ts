/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  actor: string
}

export type InputSchema = undefined

export interface OutputSchema {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  creator: string
  displayName?: string
  description?: string
  followersCount: number
  followsCount: number
  membersCount: number
  postsCount: number
  myState?: MyState
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

export interface MyState {
  follow?: string
  member?: string
  [k: string]: unknown
}

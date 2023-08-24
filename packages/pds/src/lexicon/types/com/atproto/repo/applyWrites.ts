/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo. */
  repo: string
  /** Validate the records? */
  validate: boolean
  writes: (Create | Update | Delete)[]
  swapCommit?: string
  [k: string]: unknown
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'InvalidSwap'
}

export type HandlerOutput = HandlerError | void
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

/** Create a new record. */
export interface Create {
  collection: string
  rkey?: string
  value: {}
  [k: string]: unknown
}

export function isCreate(v: unknown): v is Create {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#create'
  )
}

export function validateCreate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#create', v)
}

/** Update an existing record. */
export interface Update {
  collection: string
  rkey: string
  value: {}
  [k: string]: unknown
}

export function isUpdate(v: unknown): v is Update {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#update'
  )
}

export function validateUpdate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#update', v)
}

/** Delete an existing record. */
export interface Delete {
  collection: string
  rkey: string
  [k: string]: unknown
}

export function isDelete(v: unknown): v is Delete {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.applyWrites#delete'
  )
}

export function validateDelete(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.applyWrites#delete', v)
}

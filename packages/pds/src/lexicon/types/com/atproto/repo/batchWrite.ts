/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string
  /** Validate the records? */
  validate: boolean
  writes: (Create | Update | Delete)[]
  [k: string]: unknown
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | void
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

export interface Create {
  action: 'create'
  collection: string
  rkey?: string
  value: {}
  [k: string]: unknown
}

export function isCreate(v: unknown): v is Create {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.batchWrite#create'
  )
}

export function validateCreate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.batchWrite#create', v)
}

export interface Update {
  action: 'update'
  collection: string
  rkey: string
  value: {}
  [k: string]: unknown
}

export function isUpdate(v: unknown): v is Update {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.batchWrite#update'
  )
}

export function validateUpdate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.batchWrite#update', v)
}

export interface Delete {
  action: 'delete'
  collection: string
  rkey: string
  [k: string]: unknown
}

export function isDelete(v: unknown): v is Delete {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.repo.batchWrite#delete'
  )
}

export function validateDelete(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.repo.batchWrite#delete', v)
}

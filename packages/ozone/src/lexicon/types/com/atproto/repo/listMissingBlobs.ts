/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'com.atproto.repo.listMissingBlobs'

export interface QueryParams {
  limit: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  blobs: RecordBlob[]
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

export interface RecordBlob {
  $type?: $Type<'com.atproto.repo.listMissingBlobs', 'recordBlob'>
  cid: string
  recordUri: string
}

const hashRecordBlob = 'recordBlob'

export function isRecordBlob<V>(v: V) {
  return is$typed(v, id, hashRecordBlob)
}

export function validateRecordBlob<V>(v: V) {
  return validate<RecordBlob & V>(v, id, hashRecordBlob)
}

export function isValidRecordBlob<V>(v: V) {
  return isValid<RecordBlob & V>(v, id, hashRecordBlob)
}

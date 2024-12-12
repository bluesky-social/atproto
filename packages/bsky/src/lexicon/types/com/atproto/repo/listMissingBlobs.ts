/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

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

export function isRecordBlob<V>(v: V) {
  return is$typed(v, id, 'recordBlob')
}

export function validateRecordBlob(v: unknown) {
  return lexicons.validate(
    `${id}#recordBlob`,
    v,
  ) as ValidationResult<RecordBlob>
}

export function isValidRecordBlob<V>(v: V): v is V & $Typed<RecordBlob> {
  return isRecordBlob(v) && validateRecordBlob(v).success
}

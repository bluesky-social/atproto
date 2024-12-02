/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'com.atproto.repo.listRecords'

export interface QueryParams {
  /** The handle or DID of the repo. */
  repo: string
  /** The NSID of the record type. */
  collection: string
  /** The number of records to return. */
  limit: number
  cursor?: string
  /** DEPRECATED: The lowest sort-ordered rkey to start from (exclusive) */
  rkeyStart?: string
  /** DEPRECATED: The highest sort-ordered rkey to stop at (exclusive) */
  rkeyEnd?: string
  /** Flag to reverse the order of the returned records. */
  reverse?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  records: Record[]
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

export interface Record {
  $type?: $Type<'com.atproto.repo.listRecords', 'record'>
  uri: string
  cid: string
  value: { [_ in string]: unknown }
}

export function isRecord<V>(v: V) {
  return is$typed(v, id, 'record')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#record`, v) as ValidationResult<Record>
}

export function isValidRecord<V>(v: V): v is V & $Typed<Record> {
  return isRecord(v) && validateRecord(v).success
}

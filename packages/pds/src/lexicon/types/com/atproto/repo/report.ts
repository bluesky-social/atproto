/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { HandlerAuth } from '@atproto/xrpc-server'

export interface QueryParams {}

export interface InputSchema {
  reasonType: ReasonType
  reason?: string
  subject: SubjectRepo | SubjectRecord | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface OutputSchema {
  id: number
  reasonType: ReasonType
  reason?: string
  subject:
    | SubjectRepo
    | SubjectRecordRef
    | { $type: string; [k: string]: unknown }
  reportedByDid: string
  createdAt: string
  [k: string]: unknown
}

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
export type ReasonType =
  | 'com.atproto.repo.report#spam'
  | 'com.atproto.repo.report#other'
  | (string & {})

export interface SubjectRepo {
  /** The DID of the repo. */
  did: string
  [k: string]: unknown
}

export interface SubjectRecord {
  /** The DID of the repo. */
  did: string
  /** The NSID of the collection. */
  collection: string
  /** The key of the record. */
  rkey: string
  /** The CID of the version of the record. If not specified, defaults to the most recent version. */
  cid?: string
  [k: string]: unknown
}

export interface SubjectRecordRef {
  uri: string
  cid: string
  [k: string]: unknown
}

/** Moderation report reason: Spam. */
export const SPAM = 'com.atproto.repo.report#spam'
/** Moderation report reason: Other. */
export const OTHER = 'com.atproto.repo.report#other'

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'

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

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

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

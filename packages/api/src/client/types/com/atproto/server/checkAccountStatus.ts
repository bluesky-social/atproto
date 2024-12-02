/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.server.checkAccountStatus'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  activated: boolean
  validDid: boolean
  repoCommit: string
  repoRev: string
  repoBlocks: number
  indexedRecords: number
  privateStateValues: number
  expectedBlobs: number
  importedBlobs: number
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

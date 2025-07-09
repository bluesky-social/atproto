/**
 * GENERATED CODE - DO NOT MODIFY
 */
import stream from 'node:stream'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyVideoDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.video.uploadVideo'

export type QueryParams = {}
export type InputSchema = string | Uint8Array | Blob

export interface OutputSchema {
  jobStatus: AppBskyVideoDefs.JobStatus
}

export interface HandlerInput {
  encoding: 'video/mp4'
  body: stream.Readable
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess

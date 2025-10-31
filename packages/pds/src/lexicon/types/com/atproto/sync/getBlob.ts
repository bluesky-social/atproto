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

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.sync.getBlob'

export type QueryParams = {
  /** The DID of the account. */
  did: string
  /** The CID of the blob to fetch */
  cid: string
}
export type InputSchema = undefined
export type HandlerInput = void

export interface HandlerSuccess {
  encoding: '*/*'
  body: Uint8Array | stream.Readable
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?:
    | 'BlobNotFound'
    | 'RepoNotFound'
    | 'RepoTakendown'
    | 'RepoSuspended'
    | 'RepoDeactivated'
}

export type HandlerOutput = HandlerError | HandlerSuccess

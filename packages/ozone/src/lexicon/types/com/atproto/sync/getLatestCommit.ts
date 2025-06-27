/**
 * GENERATED CODE - DO NOT MODIFY
 */
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
const id = 'com.atproto.sync.getLatestCommit'

export type QueryParams = {
  /** The DID of the repo. */
  did: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cid: string
  rev: string
}

export type HandlerInput = void

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'RepoNotFound' | 'RepoTakendown' | 'RepoSuspended' | 'RepoDeactivated'
}

export type HandlerOutput = HandlerError | HandlerSuccess

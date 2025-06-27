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
const id = 'com.atproto.sync.getRepoStatus'

export type QueryParams = {
  /** The DID of the repo. */
  did: string
}
export type InputSchema = undefined

export interface OutputSchema {
  did: string
  active: boolean
  /** If active=false, this optional field indicates a possible reason for why the account is not active. If active=false and no status is supplied, then the host makes no claim for why the repository is no longer being hosted. */
  status?:
    | 'takendown'
    | 'suspended'
    | 'deleted'
    | 'deactivated'
    | 'desynchronized'
    | 'throttled'
    | (string & {})
  /** Optional field, the current rev of the repo, if active=true */
  rev?: string
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
  error?: 'RepoNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess

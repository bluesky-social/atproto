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
const id = 'com.atproto.space.getMemberState'

export type QueryParams = {
  /** Reference to the space. */
  space: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** Hex-encoded set hash of the member list. */
  setHash?: string
  /** Current revision of the member list. */
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
  error?: 'SpaceNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess

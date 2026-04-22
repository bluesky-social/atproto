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
const id = 'com.atproto.space.getSpaceCredential'

export type QueryParams = {}

export interface InputSchema {
  /** Reference to the space. */
  space: string
  /** A signed JWT member grant token. */
  grant: string
  /** The service endpoint of the requesting application, used for write notifications. */
  serviceEndpoint?: string
}

export interface OutputSchema {
  /** A signed JWT space credential. */
  credential: string
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'SpaceNotFound' | 'NotAMember' | 'InvalidGrant'
}

export type HandlerOutput = HandlerError | HandlerSuccess

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
const id = 'com.atproto.space.createSpace'

export type QueryParams = {}

export interface InputSchema {
  /** The DID of the space. */
  did: string
  /** The NSID of the space type, describing the modality of the space (e.g. app.bsky.group, app.bsky.personal). */
  type: string
  /** The space key. Used to differentiate multiple spaces of the same type under the same owner. If not provided, one will be auto-generated (TID). */
  skey?: string
  /** Default access mode for third-party applications. 'allow' means any app can access (with optional denylist), 'deny' means only explicitly allowed apps can access. */
  accessMode: 'allow' | 'deny' | (string & {})
  /** Client ID of the application that manages this space. Used to route application-level requests (join requests, invite flows, etc.). */
  managingApp?: string
}

export interface OutputSchema {
  /** URI of the created space. */
  uri: string
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
  error?: 'SpaceAlreadyExists' | 'InvalidType'
}

export type HandlerOutput = HandlerError | HandlerSuccess

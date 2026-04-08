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
const id = 'com.atproto.space.notifyMembership'

export type QueryParams = {}

export interface InputSchema {
  /** Reference to the space. */
  space: string
  /** The DID of the member. */
  did: string
  /** Whether the user is a member of the space. True for addition, false for removal. */
  isMember: boolean
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'AccountNotFound'
}

export type HandlerOutput = HandlerError | void

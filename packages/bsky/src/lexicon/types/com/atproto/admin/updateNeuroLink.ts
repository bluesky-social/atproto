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
const id = 'com.atproto.admin.updateNeuroLink'

export type QueryParams = {}

export interface InputSchema {
  /** The DID of the account. */
  did: string
  /** The new Neuro Legal ID (W ID) to link to this account. */
  newLegalId: string
}

export interface OutputSchema {
  success: boolean
  did: string
  /** Previous Legal ID (if any) */
  oldLegalId?: string
  newLegalId: string
  updatedAt: string
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
  error?: 'NotFound' | 'InvalidLegalId' | 'LegalIdInUse'
}

export type HandlerOutput = HandlerError | HandlerSuccess

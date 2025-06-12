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
const id = 'app.bsky.unspecced.handleAgeAssuranceEvent'

export type QueryParams = {}

export interface InputSchema {
  /** The name of the event being reported, e.g., 'adult-verified'. */
  name?: string
  /** The timestamp of the event. Currently in ISO 8601 format, but left open for future flexibility. */
  time?: string
  /** The account identifier of our organization, in UUID format. */
  orgId?: string
  /** The product identifier, in UUID format. */
  productId?: string
  /** The environment identifier, in UUID format. */
  environmentId?: string
  payload?: Payload
}

export interface OutputSchema {
  /** Whether the event was handled or not. */
  ack: string
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
}

export type HandlerOutput = HandlerError | HandlerSuccess

/** The payload of the event. */
export interface Payload {
  $type?: 'app.bsky.unspecced.handleAgeAssuranceEvent#payload'
  /** Misnomer: the email address of the user that was processed. */
  parentEmail?: string
  status?: PayloadStatus
  /** JSON string containing the external payload passed in when initiating the age assurance process. */
  externalPayload?: string
}

const hashPayload = 'payload'

export function isPayload<V>(v: V) {
  return is$typed(v, id, hashPayload)
}

export function validatePayload<V>(v: V) {
  return validate<Payload & V>(v, id, hashPayload)
}

/** The status property returned on the payload. */
export interface PayloadStatus {
  $type?: 'app.bsky.unspecced.handleAgeAssuranceEvent#payloadStatus'
  /** Whether the user was verified as an adult or not. */
  verified?: boolean
  /** The transaction ID of the age assurance process. */
  transactionId?: string
}

const hashPayloadStatus = 'payloadStatus'

export function isPayloadStatus<V>(v: V) {
  return is$typed(v, id, hashPayloadStatus)
}

export function validatePayloadStatus<V>(v: V) {
  return validate<PayloadStatus & V>(v, id, hashPayloadStatus)
}

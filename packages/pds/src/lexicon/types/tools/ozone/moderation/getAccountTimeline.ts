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
const id = 'tools.ozone.moderation.getAccountTimeline'

export type QueryParams = {
  did: string
}
export type InputSchema = undefined

export interface OutputSchema {
  timeline: AccountTimeline[]
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

export interface AccountTimeline {
  $type?: 'tools.ozone.moderation.getAccountTimeline#accountTimeline'
  day: string
  summary: AccountTimelineSummary[]
}

const hashAccountTimeline = 'accountTimeline'

export function isAccountTimeline<V>(v: V) {
  return is$typed(v, id, hashAccountTimeline)
}

export function validateAccountTimeline<V>(v: V) {
  return validate<AccountTimeline & V>(v, id, hashAccountTimeline)
}

export interface AccountTimelineSummary {
  $type?: 'tools.ozone.moderation.getAccountTimeline#accountTimelineSummary'
  eventSubjectType: 'account' | 'record' | 'chat' | (string & {})
  eventType: string
  count: number
}

const hashAccountTimelineSummary = 'accountTimelineSummary'

export function isAccountTimelineSummary<V>(v: V) {
  return is$typed(v, id, hashAccountTimelineSummary)
}

export function validateAccountTimelineSummary<V>(v: V) {
  return validate<AccountTimelineSummary & V>(v, id, hashAccountTimelineSummary)
}

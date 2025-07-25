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
  timeline: TimelineItem[]
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

export interface TimelineItem {
  $type?: 'tools.ozone.moderation.getAccountTimeline#timelineItem'
  day: string
  summary: TimelineItemSummary[]
}

const hashTimelineItem = 'timelineItem'

export function isTimelineItem<V>(v: V) {
  return is$typed(v, id, hashTimelineItem)
}

export function validateTimelineItem<V>(v: V) {
  return validate<TimelineItem & V>(v, id, hashTimelineItem)
}

export interface TimelineItemSummary {
  $type?: 'tools.ozone.moderation.getAccountTimeline#timelineItemSummary'
  eventSubjectType: 'account' | 'record' | 'chat' | (string & {})
  eventType: string
  count: number
}

const hashTimelineItemSummary = 'timelineItemSummary'

export function isTimelineItemSummary<V>(v: V) {
  return is$typed(v, id, hashTimelineItemSummary)
}

export function validateTimelineItemSummary<V>(v: V) {
  return validate<TimelineItemSummary & V>(v, id, hashTimelineItemSummary)
}

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
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

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class RepoNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'RepoNotFound') return new RepoNotFoundError(e)
  }

  return e
}

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
  eventType:
    | 'tools.ozone.moderation.defs#modEventTakedown'
    | 'tools.ozone.moderation.defs#modEventReverseTakedown'
    | 'tools.ozone.moderation.defs#modEventComment'
    | 'tools.ozone.moderation.defs#modEventReport'
    | 'tools.ozone.moderation.defs#modEventLabel'
    | 'tools.ozone.moderation.defs#modEventAcknowledge'
    | 'tools.ozone.moderation.defs#modEventEscalate'
    | 'tools.ozone.moderation.defs#modEventMute'
    | 'tools.ozone.moderation.defs#modEventUnmute'
    | 'tools.ozone.moderation.defs#modEventMuteReporter'
    | 'tools.ozone.moderation.defs#modEventUnmuteReporter'
    | 'tools.ozone.moderation.defs#modEventEmail'
    | 'tools.ozone.moderation.defs#modEventResolveAppeal'
    | 'tools.ozone.moderation.defs#modEventDivert'
    | 'tools.ozone.moderation.defs#modEventTag'
    | 'tools.ozone.moderation.defs#accountEvent'
    | 'tools.ozone.moderation.defs#identityEvent'
    | 'tools.ozone.moderation.defs#recordEvent'
    | 'tools.ozone.moderation.defs#modEventPriorityScore'
    | 'tools.ozone.moderation.defs#ageAssuranceEvent'
    | 'tools.ozone.moderation.defs#ageAssuranceOverrideEvent'
    | 'tools.ozone.moderation.defs#timelineEventPlcCreate'
    | 'tools.ozone.moderation.defs#timelineEventPlcOperation'
    | 'tools.ozone.moderation.defs#timelineEventPlcTombstone'
    | 'tools.ozone.hosting.getAccountHistory#accountCreated'
    | 'tools.ozone.hosting.getAccountHistory#emailConfirmed'
    | 'tools.ozone.hosting.getAccountHistory#passwordUpdated'
    | 'tools.ozone.hosting.getAccountHistory#handleUpdated'
    | (string & {})
  count: number
}

const hashTimelineItemSummary = 'timelineItemSummary'

export function isTimelineItemSummary<V>(v: V) {
  return is$typed(v, id, hashTimelineItemSummary)
}

export function validateTimelineItemSummary<V>(v: V) {
  return validate<TimelineItemSummary & V>(v, id, hashTimelineItemSummary)
}

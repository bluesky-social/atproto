import type { Generated } from 'kysely'
import type {
  $TypeOf,
  AtUriString,
  CidString,
  DatetimeString,
  DidString,
} from '@atproto/lex'
import type { chat, com, tools } from '../../lexicons/index.js'

export const eventTableName = 'moderation_event'

export interface ModerationEvent {
  id: Generated<number>
  action:
    | $TypeOf<tools.ozone.moderation.defs.ModEventTakedown>
    | $TypeOf<tools.ozone.moderation.defs.ModEventAcknowledge>
    | $TypeOf<tools.ozone.moderation.defs.ModEventEscalate>
    | $TypeOf<tools.ozone.moderation.defs.ModEventComment>
    | $TypeOf<tools.ozone.moderation.defs.ModEventLabel>
    | $TypeOf<tools.ozone.moderation.defs.ModEventReport>
    | $TypeOf<tools.ozone.moderation.defs.ModEventMute>
    | $TypeOf<tools.ozone.moderation.defs.ModEventUnmute>
    | $TypeOf<tools.ozone.moderation.defs.ModEventMuteReporter>
    | $TypeOf<tools.ozone.moderation.defs.ModEventUnmuteReporter>
    | $TypeOf<tools.ozone.moderation.defs.ModEventReverseTakedown>
    | $TypeOf<tools.ozone.moderation.defs.ModEventEmail>
    | $TypeOf<tools.ozone.moderation.defs.ModEventResolveAppeal>
    | $TypeOf<tools.ozone.moderation.defs.ModEventTag>
    | $TypeOf<tools.ozone.moderation.defs.AccountEvent>
    | $TypeOf<tools.ozone.moderation.defs.IdentityEvent>
    | $TypeOf<tools.ozone.moderation.defs.RecordEvent>
    | $TypeOf<tools.ozone.moderation.defs.ModEventPriorityScore>
    | $TypeOf<tools.ozone.moderation.defs.AgeAssuranceEvent>
    | $TypeOf<tools.ozone.moderation.defs.AgeAssuranceOverrideEvent>
    | $TypeOf<tools.ozone.moderation.defs.AgeAssurancePurgeEvent>
    | $TypeOf<tools.ozone.moderation.defs.RevokeAccountCredentialsEvent>
  subjectType:
    | com.atproto.repo.strongRef.$type
    | $TypeOf<com.atproto.admin.defs.RepoRef>
    | $TypeOf<chat.bsky.convo.defs.MessageRef>
    | $TypeOf<chat.bsky.convo.defs.ConvoRef>
  subjectDid: DidString
  subjectUri: AtUriString | null
  subjectCid: CidString | null
  subjectBlobCids: CidString[] | null
  subjectConvoId: string | null
  subjectMessageId: string | null
  createLabelVals: string | null
  negateLabelVals: string | null
  comment: string | null
  createdAt: DatetimeString
  createdBy: DidString
  durationInHours: number | null
  expiresAt: DatetimeString | null
  meta: Record<string, string | boolean | number> | null
  addedTags: string[] | null
  removedTags: string[] | null
  legacyRefId: number | null
  modTool: { name: string; meta?: { [_ in string]: unknown } } | null
  externalId: string | null
  severityLevel: string | null
  strikeCount: number | null
  strikeExpiresAt: DatetimeString | null
}

export type PartialDB = {
  [eventTableName]: ModerationEvent
}

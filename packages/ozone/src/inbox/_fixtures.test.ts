import { toDatetimeString } from '@atproto/lex-schema'
import { RecordSubject, RepoSubject } from '../mod-service/subject.js'
import type {
  ModerationEventRow,
  ModerationSubjectStatusRow,
} from '../mod-service/types.js'

export const ACCOUNT = new RepoSubject('did:plc:user')
export const RECORD = new RecordSubject(
  'at://did:plc:user/app.bsky.feed.post/abc',
  'bafyreiabc',
)

let nextId = 1
export const event = (
  overrides: Partial<ModerationEventRow> = {},
): ModerationEventRow => ({
  id: nextId++,
  action: 'tools.ozone.moderation.defs#modEventTakedown',
  subjectType: 'com.atproto.admin.defs#repoRef',
  subjectDid: 'did:plc:user',
  subjectUri: null,
  subjectCid: null,
  subjectBlobCids: null,
  subjectConvoId: null,
  subjectMessageId: null,
  createLabelVals: null,
  negateLabelVals: null,
  comment: null,
  createdAt: toDatetimeString('2026-01-01T00:00:00.000Z'),
  createdBy: 'did:plc:mod',
  durationInHours: null,
  expiresAt: null,
  meta: null,
  addedTags: null,
  removedTags: null,
  legacyRefId: null,
  modTool: null,
  externalId: null,
  severityLevel: null,
  strikeCount: null,
  strikeExpiresAt: null,
  ...overrides,
})

export const status = (
  overrides: Partial<ModerationSubjectStatusRow> = {},
): ModerationSubjectStatusRow =>
  ({
    id: 1,
    did: 'did:plc:user',
    recordPath: '',
    convoId: '',
    recordCid: null,
    blobCids: null,
    reviewState: 'tools.ozone.moderation.defs#reviewClosed',
    createdAt: toDatetimeString('2026-01-01T00:00:00.000Z'),
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastReviewedBy: null,
    lastReviewedAt: null,
    lastReportedAt: null,
    lastAppealedAt: null,
    hostingUpdatedAt: null,
    hostingDeletedAt: null,
    hostingCreatedAt: null,
    hostingDeactivatedAt: null,
    hostingReactivatedAt: null,
    hostingStatus: null,
    muteUntil: null,
    muteReportingUntil: null,
    suspendUntil: null,
    takendown: false,
    appealed: null,
    comment: null,
    tags: null,
    ageAssuranceState: 'unknown',
    ...overrides,
  }) as ModerationSubjectStatusRow

export const future = () => toDatetimeString(Date.now() + 86_400_000)
export const past = () => toDatetimeString(Date.now() - 86_400_000)

import {
  appealWindowEnd,
  isAppealWindowOpen,
  toAppealState,
} from '../src/inbox/appeal.ts'
import {
  type SubjectSnapshot,
  toActionViews,
  toEnforcementView,
  toSubjectView,
} from '../src/inbox/views.ts'
import { RecordSubject, RepoSubject } from '../src/mod-service/subject.ts'
import type {
  ModerationEventRow,
  ModerationSubjectStatusRow,
} from '../src/mod-service/types.ts'

const ACCOUNT = new RepoSubject('did:plc:user')
const RECORD = new RecordSubject(
  'at://did:plc:user/app.bsky.feed.post/abc',
  'bafyreiabc',
)

let nextId = 1
const event = (
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
  createdAt: '2026-01-01T00:00:00.000Z',
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

const status = (
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
    createdAt: '2026-01-01T00:00:00.000Z',
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

const future = () => new Date(Date.now() + 86_400_000).toISOString()
const past = () => new Date(Date.now() - 86_400_000).toISOString()

describe('inbox appeal window', () => {
  it('adds six calendar months', () => {
    expect(appealWindowEnd('2026-01-15T12:00:00.000Z', 6)).toBe(
      '2026-07-15T12:00:00.000Z',
    )
  })

  it('clamps a month-end rollover rather than spilling into the next month', () => {
    // 31 Aug + 6 months is the end of February, not 2/3 March.
    expect(appealWindowEnd('2025-08-31T00:00:00.000Z', 6)).toBe(
      '2026-02-28T00:00:00.000Z',
    )
  })

  it('closes once the window has elapsed', () => {
    expect(isAppealWindowOpen(past(), 6)).toBe(true)
    expect(isAppealWindowOpen('2020-01-01T00:00:00.000Z', 6)).toBe(false)
  })
})

describe('inbox action mapper', () => {
  it('splits takedowns by subject type and duration', () => {
    expect(toActionViews([event()])[0]).toMatchObject({
      type: 'accountTakedown',
    })
    expect(toActionViews([event({ durationInHours: 72 })])[0]).toMatchObject({
      type: 'accountSuspended',
    })
    expect(
      toActionViews([
        event({
          subjectType: 'com.atproto.repo.strongRef',
          subjectUri: RECORD.uri,
        }),
      ])[0],
    ).toMatchObject({ type: 'contentRemoved' })
  })

  it('derives takedown scope from the services it targeted', () => {
    const scopeOf = (targetServices?: string) =>
      toActionViews([
        event({ meta: targetServices ? { targetServices } : null }),
      ])[0].scope

    expect(scopeOf()).toBe('network')
    expect(scopeOf('appview')).toBe('app')
    expect(scopeOf('appview,pds')).toBe('network')
  })

  it('folds a reversal into the takedown it undoes', () => {
    const actions = toActionViews([
      event({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
      event({
        id: 2,
        action: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    ])

    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      type: 'accountTakedown',
      reversedAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('maps labels, hides the takedown labels, and pairs a negation', () => {
    const actions = toActionViews([
      event({
        id: 1,
        action: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: '!warn !takedown',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      event({
        id: 2,
        action: 'tools.ozone.moderation.defs#modEventLabel',
        negateLabelVals: '!warn',
        createdAt: '2026-01-03T00:00:00.000Z',
      }),
    ])

    // Newest first.
    expect(actions.map((a) => a.type)).toEqual(['labelRemoved', 'labelApplied'])
    expect(actions[1]).toMatchObject({
      type: 'labelApplied',
      scope: 'app',
      labels: ['!warn'],
      reversedAt: '2026-01-03T00:00:00.000Z',
    })
  })

  it('maps emails and their policies, and drops internal event types', () => {
    const actions = toActionViews([
      event({
        action: 'tools.ozone.moderation.defs#modEventEmail',
        meta: { policies: 'spam-automation,impersonation' },
      }),
      event({ action: 'tools.ozone.moderation.defs#modEventComment' }),
      event({ action: 'tools.ozone.moderation.defs#modEventReport' }),
    ])

    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      type: 'communicationSent',
      policies: ['spam-automation', 'impersonation'],
    })
  })

  it('never exposes moderator comments', () => {
    const actions = toActionViews([event({ comment: 'internal reasoning' })])
    expect(JSON.stringify(actions)).not.toContain('internal reasoning')
  })
})

describe('inbox enforcement mapper', () => {
  const enforcement = (
    subject: RepoSubject | RecordSubject,
    row: Partial<ModerationSubjectStatusRow>,
    labels: string[] = [],
    actions = [{ id: 1, type: 'accountTakedown', createdAt: '', scope: 'app' }],
  ) =>
    toEnforcementView({
      subject,
      status: status(row),
      labels,
      actions,
    })

  it('reports an account takedown, taking scope from the action', () => {
    expect(enforcement(ACCOUNT, { takendown: true })).toEqual({
      state: 'takendown',
      scope: 'app',
    })
  })

  it('reports a temporary account takedown as a suspension with an expiry', () => {
    const suspendUntil = future()
    expect(enforcement(ACCOUNT, { takendown: true, suspendUntil })).toEqual({
      state: 'suspended',
      scope: 'app',
      expiresAt: suspendUntil,
    })
  })

  it('reports a record takedown as removed', () => {
    expect(enforcement(RECORD, { takendown: true })).toMatchObject({
      state: 'removed',
    })
  })

  it('lets a takedown outrank labels while still listing them', () => {
    expect(
      enforcement(ACCOUNT, { takendown: true }, ['!warn', '!takedown']),
    ).toMatchObject({ state: 'takendown', labels: ['!warn'] })
  })

  it('falls back to labeled, then to none', () => {
    expect(enforcement(ACCOUNT, {}, ['!warn'])).toEqual({
      state: 'labeled',
      scope: 'app',
      labels: ['!warn'],
    })
    expect(enforcement(ACCOUNT, {})).toEqual({ state: 'none' })
    // A takedown label on its own is enforcement state, not a label.
    expect(enforcement(ACCOUNT, {}, ['!takedown'])).toEqual({ state: 'none' })
  })

  it('does not treat an elapsed suspension as enforcement', () => {
    expect(enforcement(ACCOUNT, { suspendUntil: past() })).toEqual({
      state: 'none',
    })
  })
})

describe('inbox appeal mapper', () => {
  const appealable = past()
  const appeal = (
    subject: RepoSubject | RecordSubject,
    args: {
      appealed?: boolean | null
      lastAppealedAt?: string | null
      report?: {
        id: number
        status: string
        createdAt: string
        closedAt: string | null
      } | null
      publicNote?: string | null
      latestAppealableAt?: string | null
    } = {},
  ) =>
    toAppealState({
      subject,
      status: status({
        appealed: args.appealed ?? null,
        lastAppealedAt: args.lastAppealedAt ?? null,
      }),
      report: args.report ?? null,
      publicNote: args.publicNote ?? null,
      windowMonths: 6,
      latestAppealableAt:
        args.latestAppealableAt === undefined
          ? appealable
          : args.latestAppealableAt,
    })

  const openReport = {
    id: 7,
    status: 'open',
    createdAt: '2026-01-02T00:00:00.000Z',
    closedAt: null,
  }
  const closedReport = {
    ...openReport,
    status: 'closed',
    closedAt: '2026-01-05T00:00:00.000Z',
  }

  it('offers an appeal when the window is open and none has been filed', () => {
    const { view, availableActions } = appeal(ACCOUNT)
    expect(view).toMatchObject({
      state: 'none',
      appealableUntil: appealWindowEnd(appealable, 6),
    })
    expect(availableActions).toEqual(['appeal'])
  })

  it('expires once the window elapses with no appeal', () => {
    const { view, availableActions } = appeal(ACCOUNT, {
      latestAppealableAt: '2020-01-01T00:00:00.000Z',
    })
    expect(view.state).toBe('expired')
    expect(availableActions).toEqual([])
  })

  it('stays none when there is nothing appealable at all', () => {
    const { view, availableActions } = appeal(ACCOUNT, {
      latestAppealableAt: null,
    })
    expect(view).toEqual({ state: 'none' })
    expect(availableActions).toEqual([])
  })

  it('reads pending off the same flag the submission guard writes', () => {
    const { view, availableActions } = appeal(ACCOUNT, {
      appealed: true,
      lastAppealedAt: '2026-01-02T00:00:00.000Z',
      report: openReport,
    })
    expect(view).toMatchObject({
      state: 'pending',
      appealedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(availableActions).toEqual([])
  })

  it('resolves with the close date and the public note', () => {
    const { view } = appeal(ACCOUNT, {
      appealed: false,
      report: closedReport,
      publicNote: 'We reviewed this again and the post still violates policy.',
    })
    expect(view).toMatchObject({
      state: 'resolved',
      resolvedAt: closedReport.closedAt,
      note: 'We reviewed this again and the post still violates policy.',
    })
  })

  it('supersedes an appeal cleared without ever being closed', () => {
    const { view } = appeal(ACCOUNT, { appealed: false, report: openReport })
    expect(view.state).toBe('superseded')
    expect(view).not.toHaveProperty('resolvedAt')
    expect(view).not.toHaveProperty('note')
  })

  it('gives an account another appeal after the last one closes', () => {
    expect(
      appeal(ACCOUNT, { appealed: false, report: closedReport })
        .availableActions,
    ).toEqual(['appeal'])
  })

  it('never re-offers an appeal on a record', () => {
    expect(
      appeal(RECORD, { appealed: false, report: closedReport })
        .availableActions,
    ).toEqual([])
  })
})

describe('inbox subject view', () => {
  const snapshot = (
    overrides: Partial<SubjectSnapshot> = {},
  ): SubjectSnapshot => ({
    status: status(),
    events: [],
    labels: [],
    actionCount: 0,
    firstActionAt: null,
    latestAppealableAt: null,
    appealReport: null,
    appealPublicNote: null,
    ...overrides,
  })

  const compose = (overrides: Partial<SubjectSnapshot> = {}) =>
    toSubjectView({
      subject: ACCOUNT,
      serviceDid: 'did:plc:modservice',
      cfg: { appealWindowMonths: 6 },
      snapshot: snapshot(overrides),
    })

  it('returns nothing for a subject with no history at all', () => {
    expect(compose({ status: null })).toBeNull()
  })

  it('dates the subject from its first action, not its status row', () => {
    const view = compose({
      firstActionAt: '2026-01-01T00:00:00.000Z',
      actionCount: 1,
      events: [event({ createdAt: '2026-03-01T00:00:00.000Z' })],
    })

    expect(view).toMatchObject({
      src: 'did:plc:modservice',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      actionCount: 1,
      latestAction: { type: 'accountTakedown' },
    })
  })

  it('reports the total action count even when the event window was capped', () => {
    // One event loaded, many more behind it.
    const view = compose({
      actionCount: 500,
      firstActionAt: '2020-01-01T00:00:00.000Z',
      events: [event()],
    })
    expect(view?.actionCount).toBe(500)
  })

  it('omits the action fields entirely when there is no public history', () => {
    const view = compose({ status: status({ appealed: true }) })
    expect(view).not.toHaveProperty('latestAction')
    expect(view).not.toHaveProperty('actionCount')
    expect(view).not.toHaveProperty('isRead')
  })

  it('lets a later appeal move updatedAt past the newest action', () => {
    const view = compose({
      actionCount: 1,
      firstActionAt: '2026-01-01T00:00:00.000Z',
      events: [event({ createdAt: '2026-01-01T00:00:00.000Z' })],
      status: status({
        appealed: true,
        lastAppealedAt: '2026-02-01T00:00:00.000Z',
      }),
      appealReport: {
        id: 1,
        status: 'open',
        createdAt: '2026-02-01T00:00:00.000Z',
        closedAt: null,
      },
    })
    expect(view?.updatedAt).toBe('2026-02-01T00:00:00.000Z')
  })
})

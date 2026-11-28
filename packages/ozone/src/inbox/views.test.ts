import { describe, expect, it } from 'vitest'
import { toDatetimeString } from '@atproto/lex'
import { DEFAULT_INBOX_POLICY_URL } from '../config/config.js'
import { tools } from '../lexicons/index.js'
import type { RecordSubject, RepoSubject } from '../mod-service/subject.js'
import type { ModerationSubjectStatusRow } from '../mod-service/types.js'
import {
  ACCOUNT,
  RECORD,
  event,
  future,
  past,
  status,
} from './_fixtures.test.js'
import {
  type SubjectSnapshot,
  toActionViews,
  toEnforcementView,
  toSubjectView,
} from './views.js'

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

  it('maps emails without takedown policies, and drops internal event types', () => {
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
    })
    expect(actions[0]).not.toHaveProperty('policies')
    expect(tools.ozone.inbox.defs.actionView.$matches(actions[0])).toBe(true)
  })

  it.each([undefined, 'https://example.com/community-guidelines'])(
    'maps structured takedown policies with fallback URL %s',
    (defaultPolicyUrl) => {
      const actions = toActionViews(
        [event({ meta: { policies: 'spam-automation,impersonation' } })],
        {
          'spam-automation': {
            name: 'Spam and automation',
            url: 'https://example.com/policies/spam',
          },
        },
        defaultPolicyUrl,
      )

      expect(actions).toHaveLength(1)
      expect(actions[0].policies).toEqual([
        {
          key: 'spam-automation',
          displayName: 'Spam and automation',
          link: 'https://example.com/policies/spam',
        },
        {
          key: 'impersonation',
          displayName: 'impersonation',
          link: defaultPolicyUrl ?? DEFAULT_INBOX_POLICY_URL,
        },
      ])
      expect(tools.ozone.inbox.defs.actionView.$matches(actions[0])).toBe(true)
    },
  )

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
    actions = [
      {
        id: 1,
        type: 'accountTakedown',
        createdAt: toDatetimeString('2026-01-01T00:00:00.000Z'),
        scope: 'app',
      },
    ],
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

  it('keeps an expired temporary takedown temporary until reversal', () => {
    const suspendUntil = past()
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
    expect(view?.isRead).toBe(false)
  })

  it('keeps the status creation date unless a tag-only appeal hides it', () => {
    const input = {
      subject: ACCOUNT,
      serviceDid: 'did:plc:modservice',
      cfg: { appealWindowMonths: 6 },
      snapshot: snapshot({
        appealReport: {
          id: 1,
          status: 'open',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          closedAt: null,
        },
      }),
    }
    expect(toSubjectView(input)?.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(
      toSubjectView({ ...input, hideStatusCreatedAt: true })?.createdAt,
    ).toBe('2026-02-01T00:00:00.000Z')
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
        updatedAt: '2026-02-01T00:00:00.000Z',
        closedAt: null,
      },
    })
    expect(view?.updatedAt).toBe('2026-02-01T00:00:00.000Z')
  })
})

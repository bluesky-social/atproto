import { describe, expect, it } from 'vitest'
import { type DatetimeString, toDatetimeString } from '@atproto/lex'
import type { RecordSubject, RepoSubject } from '../mod-service/subject.js'
import { ACCOUNT, RECORD, past, status } from './_fixtures.test.js'
import { appealWindowEnd, isAppealWindowOpen, toAppealState } from './appeal.js'

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

describe('inbox appeal mapper', () => {
  const appealable = past()
  const appeal = (
    subject: RepoSubject | RecordSubject,
    args: {
      appealed?: boolean | null
      lastAppealedAt?: DatetimeString | null
      report?: {
        id: number
        status: string
        createdAt: DatetimeString
        updatedAt: DatetimeString
        closedAt: DatetimeString | null
      } | null
      latestAppealableAt?: DatetimeString | null
    } = {},
  ) =>
    toAppealState({
      subject,
      status: status({
        appealed: args.appealed ?? null,
        lastAppealedAt: args.lastAppealedAt ?? null,
      }),
      report: args.report ?? null,
      windowMonths: 6,
      latestAppealableAt:
        args.latestAppealableAt === undefined
          ? appealable
          : args.latestAppealableAt,
    })

  const openReport = {
    id: 7,
    status: 'open',
    createdAt: toDatetimeString('2026-01-02T00:00:00.000Z'),
    updatedAt: toDatetimeString('2026-01-02T00:00:00.000Z'),
    closedAt: null,
  }
  const closedReport = {
    ...openReport,
    status: 'closed',
    closedAt: toDatetimeString('2026-01-05T00:00:00.000Z'),
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
      latestAppealableAt: toDatetimeString('2020-01-01T00:00:00.000Z'),
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

  it('reads pending from the same report state as the submission guard', () => {
    const { view, availableActions } = appeal(ACCOUNT, {
      appealed: true,
      lastAppealedAt: toDatetimeString('2026-01-02T00:00:00.000Z'),
      report: openReport,
    })
    expect(view).toMatchObject({
      state: 'pending',
      appealedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(availableActions).toEqual([])
  })

  it('resolves with the close date even when the appeal flag is stale', () => {
    const { view } = appeal(ACCOUNT, {
      appealed: true,
      report: closedReport,
    })
    expect(view).toMatchObject({
      state: 'resolved',
      resolvedAt: closedReport.closedAt,
    })
  })

  it.each(['open', 'queued', 'assigned', 'escalated'])(
    'keeps a %s appeal pending even when the appeal flag is cleared',
    (reportStatus) => {
      const { view } = appeal(ACCOUNT, {
        appealed: false,
        report: { ...openReport, status: reportStatus },
      })
      expect(view.state).toBe('pending')
      expect(view).not.toHaveProperty('resolvedAt')
      expect(view).not.toHaveProperty('note')
    },
  )

  it('gives an account another appeal after a new action', () => {
    expect(
      appeal(ACCOUNT, { appealed: false, report: closedReport })
        .availableActions,
    ).toEqual(['appeal'])
  })

  it('re-offers an appeal on a record after a new action', () => {
    expect(
      appeal(RECORD, { appealed: false, report: closedReport })
        .availableActions,
    ).toEqual(['appeal'])
  })

  it('does not re-offer an appeal without an action after closure', () => {
    expect(
      appeal(RECORD, {
        report: closedReport,
        latestAppealableAt: closedReport.closedAt,
      }).availableActions,
    ).toEqual([])
  })
})

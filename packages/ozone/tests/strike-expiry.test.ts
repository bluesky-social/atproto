import { toDatetimeString } from '@atproto/lex'
import { com, tools } from '../src/lexicons/index.js'
import {
  type StrikeEvent,
  reconcileStrikeEvents,
} from '../src/mod-service/strike-expiry.js'

const defs = tools.ozone.moderation.defs
const createdAt = toDatetimeString('2025-01-01T12:34:56.789Z')
const original: StrikeEvent = {
  id: 1,
  action: defs.modEventTakedown.$type,
  subjectType: com.atproto.admin.defs.repoRef.$type,
  subjectUri: null,
  subjectConvoId: null,
  subjectMessageId: null,
  createdAt,
  severityLevel: 'Sev 1',
  strikeCount: 2,
  strikeExpiresAt: null,
  meta: null,
}
const reverse: StrikeEvent = {
  ...original,
  id: 2,
  action: defs.modEventReverseTakedown.$type,
  createdAt: toDatetimeString('2025-08-01T00:00:00.000Z'),
  strikeCount: -2,
}

describe('policy strike expiry', () => {
  it('adopts NULL expiry from the original event time and uses exact days', () => {
    const annual = reconcileStrikeEvents(
      [original],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(annual.events[0].strikeExpiresAt).toBe('2026-01-01T12:34:56.789Z')
    expect(annual.events[0].meta?.strikeExpiryPolicy).toBe(true)
    const shorter = reconcileStrikeEvents(annual.events, { 'sev-1': 180 })
    expect(shorter.events[0].strikeExpiresAt).toBe('2025-06-30T12:34:56.789Z')
    expect(shorter.events[0].strikeCount).toBe(2)
  })

  it('leaves historical NULL expiry alone until backfill adoption', () => {
    expect(
      reconcileStrikeEvents([original], { 'sev-1': 365 }).events[0]
        .strikeExpiresAt,
    ).toBeNull()
    expect(
      reconcileStrikeEvents([original], { 'sev-1': 365 }, { newEventId: 1 })
        .events[0].strikeExpiresAt,
    ).toBe('2026-01-01T12:34:56.789Z')
  })

  it('preserves explicit expiries through adoption and later policy edits', () => {
    const explicit = {
      ...original,
      strikeExpiresAt: toDatetimeString('2027-01-01T00:00:00.000Z'),
    }
    const plan = reconcileStrikeEvents(
      [explicit],
      { 'sev-1': 180 },
      { adoptLegacy: true },
    )
    expect(plan.events[0].strikeExpiresAt).toBe(explicit.strikeExpiresAt)
    expect(plan.events[0].meta?.strikeExpiryPolicy).toBeUndefined()
  })

  it.each([0, null])('keeps %s-day severities permanent', (days) => {
    const plan = reconcileStrikeEvents(
      [original],
      { 'sev-1': days },
      { adoptLegacy: true },
    )
    expect(plan.events[0].strikeExpiresAt).toBeNull()
  })

  it('leaves unknown severities and zero-strike warnings alone', () => {
    const plan = reconcileStrikeEvents(
      [original, { ...original, id: 2, strikeCount: 0 }],
      {},
      { adoptLegacy: true },
    )
    expect(
      plan.events.every(
        (e) => e.strikeExpiresAt === null && !e.meta?.strikeExpiryPolicy,
      ),
    ).toBe(true)
  })

  it('handles emails while preserving strike amounts', () => {
    const plan = reconcileStrikeEvents(
      [{ ...original, action: defs.modEventEmail.$type }],
      { 'sev-1': 365 },
      { newEventId: 1 },
    )
    expect(plan.events[0].strikeExpiresAt).toBe('2026-01-01T12:34:56.789Z')
    expect(plan.events[0].strikeCount).toBe(2)
  })

  it('keeps reversals on the original expiry even when reversal occurs after expiry', () => {
    const plan = reconcileStrikeEvents(
      [original, reverse],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(plan.unmatchedReversals).toEqual([])
    expect(plan.events[1].meta?.strikeReversalOf).toBe(1)
    expect(plan.events[1].strikeExpiresAt).toBe(plan.events[0].strikeExpiresAt)
    const shorter = reconcileStrikeEvents(plan.events, { 'sev-1': 180 })
    expect(shorter.events[1].strikeExpiresAt).toBe('2025-06-30T12:34:56.789Z')
    expect(shorter.events[1].strikeExpiresAt).toBe(
      shorter.events[0].strikeExpiresAt,
    )
  })

  it('reserves historical reversals without adopting them during normal processing', () => {
    const plan = reconcileStrikeEvents(
      [original, reverse, { ...reverse, id: 3 }],
      { 'sev-1': 365 },
      { newEventId: 3 },
    )
    expect(plan.unmatchedReversals).toEqual([3])
    expect(plan.events[1].meta?.strikeReversalOf).toBeUndefined()
  })

  it('allows partial reversal up to the original amount', () => {
    const partial = { ...reverse, strikeCount: -1 }
    const plan = reconcileStrikeEvents(
      [original, partial, { ...partial, id: 3 }],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(plan.unmatchedReversals).toEqual([])
    expect(
      plan.events.slice(1).every((e) => e.meta?.strikeReversalOf === 1),
    ).toBe(true)
  })

  it('flags a positive strike count on a reversal', () => {
    const plan = reconcileStrikeEvents(
      [original, { ...reverse, strikeCount: 1 }],
      { 'sev-1': 365 },
      { newEventId: 2 },
    )
    expect(plan.unmatchedReversals).toEqual([2])
  })

  it('does not reuse a strike behind a more recent takedown with no strike count', () => {
    const plan = reconcileStrikeEvents(
      [
        original,
        { ...original, id: 2, strikeCount: null },
        { ...reverse, id: 3 },
      ],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(plan.unmatchedReversals).toEqual([3])
  })

  it('does not fall back to an older strike when the latest takedown was a warning', () => {
    const plan = reconcileStrikeEvents(
      [original, { ...original, id: 2, strikeCount: 0 }, { ...reverse, id: 3 }],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(plan.unmatchedReversals).toEqual([3])
  })

  it.each([
    { subjectUri: 'at://did:plc:someone/app.bsky.feed.post/other' },
    { subjectConvoId: 'other' },
    { subjectMessageId: 'other' },
    { severityLevel: 'sev-2' },
    { strikeCount: -3 },
    { meta: { strikeReversalOf: 999 } },
  ])('flags reversals with mismatched source: %s', (change) => {
    const plan = reconcileStrikeEvents(
      [original, { ...reverse, ...change } as StrikeEvent],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(plan.unmatchedReversals).toEqual([2])
  })

  it('does not change saved expiry when a severity is removed from configuration', () => {
    const plan = reconcileStrikeEvents(
      [original],
      { 'sev-1': 365 },
      { adoptLegacy: true },
    )
    expect(
      reconcileStrikeEvents(plan.events, {}).events[0].strikeExpiresAt,
    ).toBe(plan.events[0].strikeExpiresAt)
  })

  it('rejects durations that cannot produce a valid stored date', () => {
    expect(() =>
      reconcileStrikeEvents(
        [original],
        { 'sev-1': Number.MAX_SAFE_INTEGER },
        { adoptLegacy: true },
      ),
    ).toThrow('date range')
  })
})

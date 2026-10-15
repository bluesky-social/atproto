import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import { currentDatetimeString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import { tools } from '../lexicons/index.js'
import { SeverityLevelSettingKey } from '../setting/constants.js'
import {
  type StrikeEvent,
  type StrikeExpiryPolicy,
  reconcileStrikeEvents,
  severityKey,
} from './strike-expiry.js'

export type StrikeServiceCreator = (db: Database) => StrikeService

export class StrikeService {
  constructor(private db: Database) {}

  static creator() {
    return (db: Database) => {
      return new StrikeService(db)
    }
  }

  async lockSubject(subjectDid: DidString): Promise<void> {
    this.db.assertTransaction()
    // @NOTE Share the inbox standing lock, even when inbox production is disabled.
    await sql`select pg_advisory_xact_lock(hashtextextended(${subjectDid}, 1))`.execute(
      this.db.db,
    )
  }

  async getExpiryPolicy(): Promise<StrikeExpiryPolicy> {
    return (await this.getExpiryPolicyState()).policy
  }

  async getExpiryPolicyState(): Promise<{
    policy: StrikeExpiryPolicy
    revision: string
  }> {
    let query = this.db.db
      .selectFrom('setting')
      .where('key', '=', SeverityLevelSettingKey)
      .where('scope', '=', 'instance')
      .orderBy('id', 'desc')
      .limit(1)
      .select(['id', 'value', sql<string>`"updatedAt"::text`.as('revision')])
    // @NOTE A setting edit cannot commit ahead of a writer using its old expiry.
    if (this.db.isTransaction) query = query.forShare()
    const option = await query.executeTakeFirst()
    const policy: StrikeExpiryPolicy = Object.create(null)
    for (const [level, value] of Object.entries(option?.value ?? {})) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid strike severity configuration: ${level}`)
      }
      const days = (value as { expiryInDays?: unknown }).expiryInDays
      if (
        days !== undefined &&
        (typeof days !== 'number' || !Number.isSafeInteger(days) || days < 0)
      ) {
        throw new Error(`Invalid strike expiry configuration: ${level}`)
      }
      const normalized = severityKey(level)
      if (Object.hasOwn(policy, normalized))
        throw new Error(`Conflicting strike severity keys: ${normalized}`)
      policy[normalized] = typeof days === 'number' && days > 0 ? days : null
    }
    return {
      policy,
      revision: option ? `${option.id}:${option.revision}` : 'none',
    }
  }

  async getSubjectStrikeEvents(
    subjectDid: DidString,
    pending?: StrikeEvent,
  ): Promise<StrikeEvent[]> {
    const query = this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', subjectDid)
      .select([
        'id',
        'action',
        'subjectType',
        'subjectUri',
        'subjectConvoId',
        'subjectMessageId',
        'createdAt',
        'severityLevel',
        'strikeCount',
        'strikeExpiresAt',
        'meta',
      ])
    const events = await query
      .where('strikeCount', 'is not', null)
      .limit(10001)
      .execute()
    if (events.length > 10000)
      throw new Error('Strike history exceeds the supported account limit')
    const reversals = events.filter(
      (event) =>
        (event.strikeCount ?? 0) < 0 &&
        event.meta?.strikeReversalOf === undefined,
    )
    if (pending) reversals.push(pending)
    // @NOTE Seek only the predecessor of an unlinked reversal. Fetching every
    // NULL-strike takedown would scan large pre-strike histories for each DID.
    for (const reversal of reversals) {
      let sourceQuery = query
        .where(
          'action',
          '=',
          tools.ozone.moderation.defs.modEventTakedown.$type,
        )
        .where('subjectType', '=', reversal.subjectType)
        .where(
          'subjectUri',
          reversal.subjectUri === null ? 'is' : '=',
          reversal.subjectUri,
        )
        .where(
          'subjectConvoId',
          reversal.subjectConvoId === null ? 'is' : '=',
          reversal.subjectConvoId,
        )
        .where(
          'subjectMessageId',
          reversal.subjectMessageId === null ? 'is' : '=',
          reversal.subjectMessageId,
        )
        .where('createdAt', '<=', reversal.createdAt)
      if (reversal.id !== Number.MAX_SAFE_INTEGER)
        sourceQuery = sourceQuery.where((eb) =>
          eb.or([
            eb('createdAt', '<', reversal.createdAt),
            eb('id', '<', reversal.id),
          ]),
        )
      const source = await sourceQuery
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirst()
      if (source && !events.some((event) => event.id === source.id))
        events.push(source)
    }
    return events.sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
    )
  }

  async prepareEvent(
    subjectDid: DidString,
    event: Omit<StrikeEvent, 'id'>,
  ): Promise<StrikeEvent> {
    this.db.assertTransaction()
    const newEventId = Number.MAX_SAFE_INTEGER
    const policy = await this.getExpiryPolicy()
    await this.reconcileSubjectExpiry(subjectDid, policy)
    const history =
      event.strikeCount !== null && event.strikeCount < 0
        ? await this.getSubjectStrikeEvents(subjectDid, {
            ...event,
            id: newEventId,
          })
        : []
    const events = [...history, { ...event, id: newEventId }].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
    )
    const plan = reconcileStrikeEvents(events, policy, { newEventId })
    if (plan.unmatchedReversals.includes(newEventId)) {
      throw new InvalidRequestError(
        'Strike reversal must match the most recent takedown for this subject and cannot exceed its remaining strikes',
      )
    }
    return plan.events.find((event) => event.id === newEventId)!
  }

  /** Refresh policy-managed expiries without adopting legacy NULL expiries. */
  async reconcileSubjectExpiry(
    subjectDid: DidString,
    policy: StrikeExpiryPolicy,
  ): Promise<number> {
    this.db.assertTransaction()
    await this.lockSubject(subjectDid)
    const history = await this.getSubjectStrikeEvents(subjectDid)
    const plan = reconcileStrikeEvents(history, policy)
    let changed = 0
    for (let i = 0; i < history.length; i++) {
      if (history[i].strikeExpiresAt === plan.events[i].strikeExpiresAt)
        continue
      await this.db.db
        .updateTable('moderation_event')
        .set({ strikeExpiresAt: plan.events[i].strikeExpiresAt })
        .where('id', '=', history[i].id)
        .execute()
      changed++
    }
    await this.updateSubjectStrikeCount(subjectDid)
    return changed
  }

  /**
   * Update the strike count in account_strike table
   */
  async updateSubjectStrikeCount(subjectDid: DidString): Promise<void> {
    if (!this.db.isTransaction) {
      return this.db.transaction((txn) =>
        new StrikeService(txn).updateSubjectStrikeCount(subjectDid),
      )
    }
    await this.lockSubject(subjectDid)
    const now = currentDatetimeString()

    // This should not incur too many rows since we tend to do permanent takedown on relatively low strike count
    // and we have a very specific index to support this query
    const events = await this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', subjectDid)
      .where('strikeCount', '<>', 0)
      .select(['strikeCount', 'strikeExpiresAt', 'createdAt'])
      .orderBy('createdAt', 'asc')
      .execute()

    if (!events.length) {
      return
    }

    let activeStrikeCount = 0
    let totalStrikeCount = 0

    const firstStrikeAt = events[0].createdAt
    const lastStrikeAt = events[events.length - 1].createdAt

    for (const event of events) {
      const strikeCount = event.strikeCount || 0
      totalStrikeCount += strikeCount

      // Count as active if not expired
      const isActive =
        event.strikeExpiresAt === null || event.strikeExpiresAt > now
      if (isActive) {
        activeStrikeCount += strikeCount
      }
    }

    await this.db.db
      .insertInto('account_strike')
      .values({
        did: subjectDid,
        activeStrikeCount,
        totalStrikeCount,
        firstStrikeAt,
        lastStrikeAt,
      })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          activeStrikeCount,
          totalStrikeCount,
          firstStrikeAt,
          lastStrikeAt,
        }),
      )
      .execute()
  }

  /**
   * Get distinct subjects with expired strikes since a given timestamp
   * Used by the strike expiry processor to find accounts that need strike count updates
   */
  async getExpiredStrikeSubjects(
    afterTimestamp?: DatetimeString,
  ): Promise<Array<{ subjectDid: DidString }>> {
    const now = currentDatetimeString()

    let query = this.db.db
      .selectFrom('moderation_event')
      .where('strikeExpiresAt', 'is not', null)
      .where('strikeExpiresAt', '<=', now)
      .where('strikeCount', '<>', 0)
      .select('subjectDid')
      .distinct()

    // Only process strikes that expired since the last run
    if (afterTimestamp) {
      query = query.where('strikeExpiresAt', '>=', afterTimestamp)
    }

    return await query.execute()
  }
}

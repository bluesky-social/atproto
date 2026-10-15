import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import { currentDatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import { dbLogger } from '../logger.js'
import { SeverityLevelSettingKey } from '../setting/constants.js'
import { expiryAfterDays, validExpiryDays } from './strike-expiry.js'

export type StrikeServiceCreator = (db: Database) => StrikeService

export class StrikeService {
  constructor(
    private db: Database,
    readonly expiryDays?: number,
  ) {}

  static creator(expiryDays?: number) {
    return (db: Database) => {
      return new StrikeService(db, expiryDays)
    }
  }

  async lockSubject(subjectDid: DidString): Promise<void> {
    this.db.assertTransaction()
    await sql`select pg_advisory_xact_lock(hashtextextended(${subjectDid}, 1))`.execute(
      this.db.db,
    )
  }

  /** Supply only missing expiry; the client still chooses the signed strike count. */
  async getEventExpiry(severityLevel: string, createdAt: DatetimeString) {
    const setting = await this.db.db
      .selectFrom('setting')
      .where('key', '=', SeverityLevelSettingKey)
      .where('scope', '=', 'instance')
      .orderBy('id', 'desc')
      .select('value')
      .limit(1)
      .executeTakeFirst()
    const normalize = (name: string) => name.toLowerCase().replace(/\s/g, '-')
    const definition = Object.entries(setting?.value ?? {}).find(
      ([name]) => normalize(name) === normalize(severityLevel),
    )?.[1]
    const days =
      definition &&
      typeof definition === 'object' &&
      'expiryInDays' in definition
        ? definition.expiryInDays
        : undefined
    if (!validExpiryDays(days)) return undefined
    return {
      strikeExpiresAt: expiryAfterDays(createdAt, this.expiryDays ?? days),
      // Save the configured duration so unsetting the override restores it.
      meta: { strikeExpiryDays: days },
    }
  }

  /** Reconcile only adopted expiries; never infer reversal sources or adopt legacy rows. */
  async refreshSubjectExpiry(subjectDid: DidString): Promise<void> {
    this.db.assertTransaction()
    await this.lockSubject(subjectDid)
    const events = await this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', subjectDid)
      .where('strikeCount', '<>', 0)
      .select(['id', 'createdAt', 'strikeExpiresAt', 'meta'])
      .execute()
    let changed = false
    for (const event of events) {
      const days = event.meta?.strikeExpiryDays
      if (!validExpiryDays(days)) continue
      let strikeExpiresAt: DatetimeString
      try {
        strikeExpiresAt = expiryAfterDays(
          event.createdAt,
          this.expiryDays ?? days,
        )
      } catch (err) {
        dbLogger.warn(
          { err, eventId: event.id },
          'skipping invalid managed strike expiry',
        )
        continue
      }
      if (strikeExpiresAt === event.strikeExpiresAt) continue
      await this.db.db
        .updateTable('moderation_event')
        .set({ strikeExpiresAt })
        .where('id', '=', event.id)
        .execute()
      changed = true
    }
    if (changed) await this.updateSubjectStrikeCount(subjectDid)
  }

  /**
   * Update the strike count in account_strike table
   */
  async updateSubjectStrikeCount(subjectDid: DidString): Promise<void> {
    if (!this.db.isTransaction) {
      return this.db.transaction((txn) =>
        new StrikeService(txn, this.expiryDays).updateSubjectStrikeCount(
          subjectDid,
        ),
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

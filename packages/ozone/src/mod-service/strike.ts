import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'

export type SeverityLevelConfig = {
  strikeCount?: number
  firstOccurrenceStrikeCount?: number
  strikeOnOccurrence?: number
  needsTakedown?: boolean
  expiresInDays?: number
}

export type StrikeThresholds = Record<string, number | null>

export type StrikeServiceCreator = (db: Database) => StrikeService

export class StrikeService {
  constructor(private db: Database) {}

  static creator() {
    return (db: Database) => {
      return new StrikeService(db)
    }
  }

  async lockSubject(subjectDid: string): Promise<void> {
    await sql`select pg_advisory_xact_lock(hashtext(${subjectDid}))`.execute(
      this.db.db,
    )
  }

  async getActiveStrikeCount(subjectDid: string): Promise<number> {
    const now = new Date().toISOString()
    const result = await this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', subjectDid)
      .where('strikeCount', 'is not', null)
      .where((eb) =>
        eb.or([
          eb('strikeExpiresAt', 'is', null),
          eb('strikeExpiresAt', '>', now),
        ]),
      )
      .select((eb) => eb.fn.sum<number>('strikeCount').as('count'))
      .executeTakeFirst()
    return Number(result?.count ?? 0)
  }

  async computeStrike(input: {
    subjectDid: string
    policies: string[]
    severityLevel: string
    config: SeverityLevelConfig
    createdAt: Date
  }): Promise<{
    strikeCount: number
    strikeExpiresAt?: string
    needsTakedown: boolean
  }> {
    const { subjectDid, policies, severityLevel, config, createdAt } = input
    if (
      !config.needsTakedown &&
      config.strikeCount === undefined &&
      config.firstOccurrenceStrikeCount === undefined
    ) {
      throw new InvalidRequestError(
        `Severity level has no strike configuration: ${severityLevel}`,
      )
    }

    const prior = await this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', subjectDid)
      .where('action', 'in', [
        'tools.ozone.moderation.defs#modEventTakedown',
        'tools.ozone.moderation.defs#modEventEmail',
      ])
      .where(sql<boolean>`meta->>'strikeCascade' is distinct from 'true'`)
      .where((eb) =>
        eb.or(
          policies.map((policy) =>
            eb(
              sql<boolean>`${policy} = any(string_to_array(meta->>'policies', ','))`,
              '=',
              true,
            ),
          ),
        ),
      )
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    const occurrence = Number(prior.count) + 1

    let strikeCount = config.strikeCount ?? 0
    if (occurrence === 1 && config.firstOccurrenceStrikeCount !== undefined) {
      strikeCount = config.firstOccurrenceStrikeCount
    } else if (
      config.strikeOnOccurrence !== undefined &&
      occurrence < config.strikeOnOccurrence
    ) {
      strikeCount = 0
    }

    const strikeExpiresAt =
      config.expiresInDays !== undefined && config.expiresInDays > 0
        ? new Date(
            createdAt.getTime() + config.expiresInDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : undefined
    return {
      strikeCount: config.needsTakedown ? 0 : strikeCount,
      strikeExpiresAt,
      needsTakedown: !!config.needsTakedown,
    }
  }

  getCrossedThreshold(input: {
    previous: number
    current: number
    thresholds: StrikeThresholds
  }): number | null | undefined {
    const crossed = Object.entries(input.thresholds)
      .map(([threshold, duration]) => ({
        threshold: Number(threshold),
        duration,
      }))
      .filter(
        ({ threshold }) =>
          input.previous < threshold && threshold <= input.current,
      )
      .sort((a, b) => b.threshold - a.threshold)[0]
    return crossed?.duration
  }

  /**
   * Update the strike count in account_strike table
   */
  async updateSubjectStrikeCount(subjectDid: string): Promise<void> {
    const now = new Date().toISOString()

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
    afterTimestamp?: string,
  ): Promise<Array<{ subjectDid: string }>> {
    const now = new Date().toISOString()

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

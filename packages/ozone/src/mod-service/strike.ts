import { Database } from '../db'

export type StrikeServiceCreator = (db: Database) => StrikeService

export class StrikeService {
  constructor(private db: Database) {}

  static creator() {
    return (db: Database) => {
      return new StrikeService(db)
    }
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

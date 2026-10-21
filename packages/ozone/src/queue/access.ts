import { type RawBuilder, sql } from 'kysely'
import { currentDatetimeString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { AdminTokenOutput, ModeratorOutput } from '../auth-verifier.js'
import type { Database } from '../db/index.js'

export type QueueAccessCredentials = (
  AdminTokenOutput | ModeratorOutput
)['credentials']

/** Request-scoped queue access. Internal jobs do not use moderator filters. */
export class QueueAccess {
  private constructor(private readonly hiddenQueueIds: number[]) {}

  /**
   * Get the queue access for a specific actor based on their credentials.
   */
  static async forActor(
    db: Database,
    credentials: QueueAccessCredentials,
  ): Promise<QueueAccess> {
    if (credentials.isAdmin) return new QueueAccess([])
    const now = currentDatetimeString()
    const hidden = await db.db
      .selectFrom('report_queue as access_queue')
      .select('access_queue.id')
      .where('access_queue.strictAccess', '=', true)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('moderator_assignment as access_member')
              .select('access_member.id')
              .whereRef('access_member.queueId', '=', 'access_queue.id')
              .where('access_member.reportId', 'is', null)
              .where('access_member.did', '=', credentials.iss)
              .where('access_member.startAt', '<=', now)
              .where((membership) =>
                membership.or([
                  membership('access_member.endAt', 'is', null),
                  membership('access_member.endAt', '>', now),
                ]),
              ),
          ),
        ),
      )
      .execute()
    return new QueueAccess(hidden.map(({ id }) => id))
  }

  /** Filter queue listings before pagination. */
  filter(column: string): RawBuilder<boolean> {
    if (!this.hiddenQueueIds.length) return sql<boolean>`true`
    const ref = sql.ref(column)
    return sql<boolean>`${ref} NOT IN (${sql.join(this.hiddenQueueIds)})`
  }

  /** Whether the caller may access a queue. */
  canAccessQueue(queueId: number): boolean {
    return !this.hiddenQueueIds.includes(queueId)
  }

  assertQueue(queueId: number): void {
    if (!this.canAccessQueue(queueId)) {
      throw new InvalidRequestError('Queue not found', 'QueueNotFound')
    }
  }
}

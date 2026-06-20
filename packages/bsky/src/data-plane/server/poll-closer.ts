import { chunkArray } from '@atproto/common'
import { dbLogger } from '../../logger.js'
import { Database } from './db/index.js'

const DEFAULT_INTERVAL_MS = 60_000
// max polls processed per sweep tick
const POLL_BATCH = 100
// max notification rows inserted per statement
const NOTIF_CHUNK = 500

type EndedPoll = {
  uri: string
  cid: string
  creator: string
  endsAt: string | null
}

/**
 * Periodically finds polls whose `endsAt` has passed and emits a one-time
 * `poll-ended` notification to the poll author and everyone who voted. The
 * `endedNotifiedAt` column guards against duplicate notifications, so a sweep
 * is idempotent and safe to re-run.
 *
 * This is the only time-triggered notification source in the AppView; every
 * other notification is emitted in response to a record write.
 */
export class PollCloser {
  private timer?: NodeJS.Timeout
  private running?: Promise<void>

  constructor(
    private db: Database,
    private opts: { intervalMs?: number } = {},
  ) {}

  start() {
    if (this.timer) return
    const interval = this.opts.intervalMs ?? DEFAULT_INTERVAL_MS
    this.timer = setInterval(() => {
      this.run().catch((err) => {
        dbLogger.error({ err }, 'poll closer sweep failed')
      })
    }, interval)
    this.timer.unref?.()
  }

  async destroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    await this.running
  }

  // Runs a single sweep. Serializes against any in-flight sweep.
  async run(now = new Date()): Promise<void> {
    if (this.running) return this.running
    this.running = this.sweep(now).finally(() => {
      this.running = undefined
    })
    return this.running
  }

  private async sweep(now: Date) {
    const nowIso = now.toISOString()
    const polls = await this.db.db
      .selectFrom('poll')
      .where('endsAt', 'is not', null)
      .where('endsAt', '<=', nowIso)
      .where('endedNotifiedAt', 'is', null)
      .select(['uri', 'cid', 'creator', 'endsAt'])
      .limit(POLL_BATCH)
      .execute()
    for (const poll of polls) {
      await this.closePoll(poll, nowIso)
    }
  }

  private async closePoll(poll: EndedPoll, nowIso: string) {
    const voters = await this.db.db
      .selectFrom('poll_vote')
      .where('subject', '=', poll.uri)
      .select('creator')
      .distinct()
      .execute()

    const recipients = new Set<string>([
      poll.creator,
      ...voters.map((v) => v.creator),
    ])
    const sortAt = poll.endsAt ?? nowIso
    const notifs = [...recipients].map((did) => ({
      did,
      author: poll.creator,
      recordUri: poll.uri,
      recordCid: poll.cid,
      reason: 'poll-ended',
      reasonSubject: poll.uri,
      sortAt,
    }))

    await this.db.transaction(async (txn) => {
      // Claim the poll first; if another sweep already notified it, bail.
      const updated = await txn.db
        .updateTable('poll')
        .set({ endedNotifiedAt: nowIso })
        .where('uri', '=', poll.uri)
        .where('endedNotifiedAt', 'is', null)
        .executeTakeFirst()
      if (!updated.numUpdatedRows) return

      for (const chunk of chunkArray(notifs, NOTIF_CHUNK)) {
        await txn.db.insertInto('notification').values(chunk).execute()
      }
    })
  }
}

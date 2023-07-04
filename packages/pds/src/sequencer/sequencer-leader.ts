import { DisconnectError } from '@atproto/xrpc-server'
import { jitter, wait } from '@atproto/common'
import { Leader } from '../db/leader'
import { seqLogger as log } from '../logger'
import Database from '../db'

export const SEQUENCER_LEADER_ID = 1100

export class SequencerLeader {
  leader: Leader

  destroyed = false
  polling = false
  queued = false
  private lastSeq: number

  constructor(public db: Database, lockId = SEQUENCER_LEADER_ID) {
    this.leader = new Leader(lockId, this.db)
  }

  nextSeqVal(): number {
    this.lastSeq++
    return this.lastSeq
  }

  peekSeqVal(): number | undefined {
    return this.lastSeq
  }

  get isLeader() {
    return !!this.leader.session
  }

  async run() {
    if (this.db.dialect === 'sqlite') return

    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const res = await this.db.db
            .selectFrom('repo_seq')
            .select('seq')
            .where('seq', 'is not', null)
            .orderBy('seq', 'desc')
            .limit(1)
            .executeTakeFirst()
          this.lastSeq = res?.seq ?? 0

          const seqListener = () => {
            if (this.polling) {
              this.queued = true
            } else {
              this.polling = true
              this.pollDb()
            }
          }
          if (signal.aborted) {
            return
          }
          this.db.channels.new_repo_event.addListener('message', seqListener)
          await new Promise<void>((resolve, reject) => {
            signal.addEventListener('abort', () => {
              this.db.channels.new_repo_event.removeListener(
                'message',
                seqListener,
              )
              const err = signal.reason
              if (!err || err instanceof DisconnectError) {
                resolve()
              } else {
                reject(err)
              }
            })
          })
        })
        if (ran && !this.destroyed) {
          throw new Error(
            'Sequencer leader completed, but should be persistent',
          )
        }
      } catch (err) {
        log.error({ err }, 'sequence leader errored')
      } finally {
        if (!this.destroyed) {
          await wait(1000 + jitter(500))
        }
      }
    }
  }

  async pollDb() {
    if (this.destroyed) {
      this.polling = false
      this.queued = false
      return
    }

    try {
      await this.sequenceOutgoing()
    } catch (err) {
      log.error({ err }, 'sequencer leader failed to sequence batch')
    } finally {
      // check if we should continue polling
      if (this.queued === false) {
        this.polling = false
      } else {
        this.queued = false
        this.pollDb()
      }
    }
  }

  async sequenceOutgoing() {
    const unsequenced = await this.getUnsequenced()
    for (const row of unsequenced) {
      await this.db.db
        .updateTable('repo_seq')
        .set({ seq: this.nextSeqVal() })
        .where('id', '=', row.id)
        .execute()
      await this.db.notify('outgoing_repo_seq')
    }
  }

  async getUnsequenced() {
    return this.db.db
      .selectFrom('repo_seq')
      .where('seq', 'is', null)
      .select('id')
      .orderBy('id', 'asc')
      .execute()
  }

  async isCaughtUp(): Promise<boolean> {
    const unsequenced = await this.getUnsequenced()
    return unsequenced.length === 0
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy(new DisconnectError())
  }
}

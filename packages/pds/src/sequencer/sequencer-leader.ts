import { DisconnectError } from '@atproto/xrpc-server'
import { Leader } from '../db/leader'
import { seqLogger as log } from '../logger'
import Database from '../db'
import { jitter, wait } from '@atproto/common'

export const SQUENCER_LEADER_ID = 1100

export class SequencerLeader {
  leader = new Leader(SQUENCER_LEADER_ID, this.db)

  destroyed = false
  polling = false
  queued = false

  constructor(public db: Database) {}

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const seqListener = () => {
            if (this.polling) {
              this.queued = true
            } else {
              this.polling = true
              this.pollDb()
            }
          }
          this.db.channels.new_repo_event.addListener('message', seqListener)
          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => {
              this.db.channels.new_repo_event.removeListener(
                'message',
                seqListener,
              )
              resolve()
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

  getNextSeq(): number {
    return 0
  }

  async sequenceOutgoing() {
    const unsequenced = await this.getUnsequenced()
    for (const row of unsequenced) {
      await this.db.db
        .updateTable('repo_seq')
        .set({ outgoingSeq: this.getNextSeq() })
        .where('seq', '=', row.seq)
        .execute()
      await this.db.notify('outgoing_repo_seq')
    }
  }

  async getUnsequenced() {
    return this.db.db
      .selectFrom('repo_seq')
      .where('outgoingSeq', 'is', null)
      .select('seq')
      .orderBy('seq', 'asc')
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

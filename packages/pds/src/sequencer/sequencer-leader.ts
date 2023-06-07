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
  lastSeq: number

  channelCb: (() => Promise<void>) | null = null

  constructor(public db: Database, lockId = SEQUENCER_LEADER_ID) {
    this.leader = new Leader(lockId, this.db)
  }

  nextSeqVal(): number {
    this.lastSeq++
    return this.lastSeq
  }

  async getLastSeq(): Promise<number> {
    const res = await this.db.db
      .selectFrom('repo_seq')
      .select('seq')
      .where('seq', 'is not', null)
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    return res?.seq ?? 0
  }

  async run() {
    if (this.db.dialect === 'sqlite') return

    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          this.lastSeq = await this.getLastSeq()
          if (signal.aborted) {
            return
          }

          await new Promise<void>((resolve, reject) => {
            this.channelCb = async () => {
              if (this.destroyed) {
                this.polling = false
                this.queued = false
                return
              }

              try {
                await this.sequenceOutgoing()
                if (this.queued === false) {
                  this.polling = false
                } else {
                  this.queued = false
                  if (this.channelCb) {
                    return this.channelCb()
                  }
                }
              } catch (err) {
                if (this.channelCb) {
                  this.db.channels.new_repo_event.removeListener(
                    'message',
                    this.channelCb,
                  )
                  this.channelCb = null
                }
                reject(err)
              }
            }

            this.db.channels.new_repo_event.addListener(
              'message',
              this.channelCb,
            )

            signal.addEventListener('abort', () => {
              if (this.channelCb) {
                this.db.channels.new_repo_event.removeListener(
                  'message',
                  this.channelCb,
                )
                this.channelCb = null
              }
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

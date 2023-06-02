import { DisconnectError } from '@atproto/xrpc-server'
import AppContext from '../context'
import { Leader } from '../db/leader'
import { seqLogger as log } from '../logger'

export const SQUENCER_LEADER_ID = 1100

export class SequencerLeader {
  leader = new Leader(SQUENCER_LEADER_ID, this.ctx.db)

  destroyed = false
  polling = false
  queued = false

  constructor(public ctx: AppContext) {}

  async run() {
    while (!this.destroyed) {
      const { ran } = await this.leader.run(async () => {
        this.ctx.db.channels.repo_seq.addListener('message', (msg) => {
          if (msg !== 'new_event') return
          if (this.polling) {
            this.queued = true
          } else {
            this.polling = true
            this.pollDb()
          }
        })
      })
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
    const unsequenced = await this.ctx.db.db
      .selectFrom('repo_seq')
      .whereNotExists((qb) =>
        qb
          .selectFrom('outgoing_repo_seq')
          .whereRef('outgoing_repo_seq.eventId', '=', 'repo_seq.id')
          .selectAll(),
      )
      .select('id')
      .orderBy('id', 'asc')
      .execute()

    for (const row of unsequenced) {
      await this.ctx.db.db
        .insertInto('outgoing_repo_seq')
        .values({ eventId: row.id })
        .execute()
      await this.ctx.db.notify('repo_seq', 'outgoing_seq')
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy(new DisconnectError())
  }
}

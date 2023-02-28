import { wait } from '@atproto/common'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import AppContext from '../../context'
import Database from '../../db'
import { Leader } from '../../db/leader'
import { lexicons } from '../../lexicon/lexicons'
import { OutputSchema as Message } from '../../lexicon/types/com/atproto/sync/subscribeAllRepos'
import { PreparedWrite } from '../../repo'

const METHOD = 'com.atproto.sync.subscribeAllRepos'
export const REPO_SUB_ID = 1000

export class RepoSubscription {
  leader = new Leader(REPO_SUB_ID, this.ctx.db)
  destroyed = false
  constructor(public ctx: AppContext) {}

  async run() {
    const { db } = this.ctx
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          for await (const msg of sub) {
            const ops = await getOps(msg)
            await db.transaction(async (tx) => {
              await this.handleOps(tx, ops)
              await this.setState(tx, { cursor: msg.seq })
            })
          }
        })
        if (ran) {
          throw new Error('Repo sub completed, but should be persistent')
        }
      } catch (err) {
        // @TODO log
      }
      if (!this.destroyed) {
        await wait(5000)
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy(new DisconnectError())
  }

  private async handleOps(_tx: Database, _ops: PreparedWrite[]) {
    // @TODO
    // const { services } = this.ctx
    // const indexingTx = services.appView.indexing(tx)
  }

  private async getState(): Promise<State> {
    const sub = await this.ctx.db.db
      .selectFrom('subscription')
      .selectAll()
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .executeTakeFirst()
    return sub ? (JSON.parse(sub.state) as State) : { cursor: -1 } // @TODO change to 0 once fix on pds lands
  }

  private async setState(tx: Database, state: State): Promise<void> {
    tx.assertTransaction()
    const res = await tx.db
      .updateTable('subscription')
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .set({ state: JSON.stringify(state) })
      .executeTakeFirst()
    if (res.numUpdatedRows < 1) {
      await tx.db
        .insertInto('subscription')
        .values({
          service: this.service,
          method: METHOD,
          state: JSON.stringify(state),
        })
        .executeTakeFirst()
    }
  }

  private getSubscription(opts: { signal: AbortSignal }) {
    return new Subscription({
      service: this.service,
      method: METHOD,
      signal: opts.signal,
      getParams: () => this.getState(),
      onReconnectError: (err) => console.log('reconnect', err), // @TODO logging
      validate: (value) => {
        return lexicons.assertValidXrpcMessage<Message>(METHOD, value)
      },
    })
  }

  private get service() {
    return this.ctx.cfg.internalUrl.replace('http://', 'ws://') // @TODO point at bgs
  }
}

async function getOps(_msg: Message): Promise<PreparedWrite[]> {
  return [] // @TODO
}

type State = { cursor: number }

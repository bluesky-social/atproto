import assert from 'node:assert'
import { AtUri } from '@atproto/uri'
import { wait } from '@atproto/common'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import { WriteOpAction, readCarWithRoot, cborToLexRecord } from '@atproto/repo'
import { PreparedWrite } from '../../repo'
import {
  Commit,
  isCommit,
  OutputSchema as Message,
} from '../../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../../lexicon/lexicons'
import Database from '../../db'
import AppContext from '../../context'
import { Leader } from '../../db/leader'
import { appViewLogger } from '../logger'

const METHOD = ids.ComAtprotoSyncSubscribeRepos
export const REPO_SUB_ID = 1000

export class RepoSubscription {
  leader = new Leader(REPO_SUB_ID, this.ctx.db)
  destroyed = false
  constructor(public ctx: AppContext, public service: string) {}

  async run() {
    const { db } = this.ctx
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          for await (const msg of sub) {
            if (!isCommit(msg)) {
              appViewLogger.warn(
                { msg },
                'unexpected message on repo subscription stream',
              )
              continue
            }
            try {
              const ops = await getOps(msg)
              await db.transaction(async (tx) => {
                await this.handleOps(tx, ops, msg.time)
                await this.setState(tx, { cursor: msg.seq })
              })
            } catch (err) {
              throw new ProcessingError(msg, { cause: err })
            }
          }
        })
        if (ran && !this.destroyed) {
          throw new Error('Repo sub completed, but should be persistent')
        }
      } catch (_err) {
        const msg = _err instanceof ProcessingError ? _err.msg : undefined
        const err = _err instanceof ProcessingError ? _err.cause : _err
        appViewLogger.error(
          {
            err,
            seq: msg?.seq,
            repo: msg?.repo,
            commit: msg?.commit,
            time: msg?.time,
            service: this.service,
          },
          'repo subscription errored',
        )
      }
      if (!this.destroyed) {
        await wait(5000 + jitter(1000))
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy(new DisconnectError())
  }

  private async handleOps(
    tx: Database,
    ops: PreparedWrite[],
    timestamp: string,
  ) {
    const { services } = this.ctx
    const indexingTx = services.appView.indexing(tx)
    for (const op of ops) {
      if (op.action === WriteOpAction.Delete) {
        await indexingTx.deleteRecord(op.uri)
      } else {
        await indexingTx.indexRecord(
          op.uri,
          op.cid,
          op.record,
          op.action, // create or update
          timestamp,
        )
      }
    }
  }

  async getState(): Promise<State> {
    const sub = await this.ctx.db.db
      .selectFrom('subscription')
      .selectAll()
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .executeTakeFirst()
    return sub ? (JSON.parse(sub.state) as State) : { cursor: 0 }
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
      onReconnectError: (err, reconnects, initial) => {
        appViewLogger.warn(
          { err, reconnects, initial },
          'repo subscription reconnect',
        )
      },
      validate: (value) => {
        try {
          return lexicons.assertValidXrpcMessage<Message>(METHOD, value)
        } catch (err) {
          appViewLogger.warn(
            {
              err,
              seq: ifNumber(value?.['seq']),
              repo: ifString(value?.['repo']),
              commit: ifString(value?.['commit']),
              time: ifString(value?.['time']),
              service: this.service,
            },
            'repo subscription skipped invalid message',
          )
        }
      },
    })
  }
}

async function getOps(msg: Commit): Promise<PreparedWrite[]> {
  const { ops } = msg
  const car = await readCarWithRoot(msg.blocks as Uint8Array)
  return ops.map((op) => {
    const [collection, rkey] = op.path.split('/')
    assert(collection && rkey)
    if (
      op.action === WriteOpAction.Create ||
      op.action === WriteOpAction.Update
    ) {
      assert(op.cid)
      const cid = op.cid
      const record = car.blocks.get(cid)
      assert(record)
      return {
        action:
          op.action === WriteOpAction.Create
            ? WriteOpAction.Create
            : WriteOpAction.Update,
        cid,
        record: cborToLexRecord(record),
        blobs: [], // @TODO need to determine how the app-view provides URLs for processed blobs
        uri: AtUri.make(msg.repo, collection, rkey),
      }
    } else if (op.action === WriteOpAction.Delete) {
      return {
        action: WriteOpAction.Delete,
        uri: AtUri.make(msg.repo, collection, rkey),
      }
    } else {
      throw new Error(`Unknown repo op action: ${op.action}`)
    }
  })
}

function jitter(maxMs) {
  return Math.round((Math.random() - 0.5) * maxMs * 2)
}

function ifString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined
}

function ifNumber(val: unknown): number | undefined {
  return typeof val === 'number' ? val : undefined
}

class ProcessingError extends Error {
  constructor(public msg: Message, opts: { cause: unknown }) {
    super('processing error', opts)
  }
}

type State = { cursor: number }

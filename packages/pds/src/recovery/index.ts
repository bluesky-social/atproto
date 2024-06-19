import PQueue from 'p-queue'
import { cborToLexRecord, parseDataKey, readCar } from '@atproto/repo'
import { filterDefined } from '@atproto/common'
import AppContext from '../context'
import { CommitEvt, TombstoneEvt, SeqEvt } from '../sequencer'
import {
  PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../repo'
import { Secp256k1Keypair } from '@atproto/crypto'

export class Recoverer {
  cursor: number
  main: PQueue
  queues = new Map<string, PQueue>()

  constructor(
    public ctx: AppContext,
    opts: { cursor: number; concurrency: number },
  ) {
    this.cursor = opts.cursor
    this.main = new PQueue({ concurrency: opts.concurrency })
  }

  async processAll() {
    await this.main.onIdle()
  }

  async destroy() {
    this.main.pause()
    this.main.clear()
    this.queues.forEach((q) => q.clear())
    await this.main.onIdle()
  }

  async addToUserQueue(did: string, task: () => Promise<void>) {
    if (this.main.isPaused) return
    return this.main.add(() => {
      return this.getUserQueue(did).add(task)
    })
  }

  private getUserQueue(did: string) {
    let queue = this.queues.get(did)
    if (!queue) {
      queue = new PQueue({ concurrency: 1 })
      queue.once('idle', () => this.queues.delete(did))
      this.queues.set(did, queue)
    }
    return queue
  }

  async run() {
    let done = false
    while (!done) {
      done = await this.loadNextPage()
      await this.main.onEmpty()
    }
    await this.main.onIdle()
  }

  private async loadNextPage(): Promise<boolean> {
    const page = await this.ctx.sequencer.requestSeqRange({
      earliestSeq: this.cursor,
      limit: 5000,
    })
    page.forEach((evt) => this.processEvent(evt))
    const lastEvt = page.at(-1)
    if (!lastEvt) {
      return true
    } else {
      this.cursor = lastEvt.seq
      return false
    }
  }

  processEvent(evt: SeqEvt) {
    // only need to process commits & tombstones
    if (evt.type === 'tombstone') {
      this.processTombstone(evt.evt)
    }
    if (evt.type === 'commit') {
      this.processCommit(evt.evt)
    }
  }

  processCommit(evt: CommitEvt) {
    const did = evt.repo
    this.addToUserQueue(did, async () => {
      const writes = await parseEvtToWrites(evt)
      if (evt.since === null) {
        // bails if actor store already exists
        await this.processRepoCreation(did, evt.rev)
      }
      await this.ctx.actorStore.transact(did, async (actorTxn) => {
        const root = await actorTxn.repo.storage.getRootDetailed()
        if (root.rev >= evt.rev) {
          return
        }
        await actorTxn.repo.processWrites(writes, undefined, evt.rev)
      })
    })
  }

  async processRepoCreation(did: string, rev: string) {
    const actorExists = await this.ctx.actorStore.exists(did)
    if (actorExists) {
      return
    }
    const keypair = await Secp256k1Keypair.create({ exportable: true })
    await this.ctx.actorStore.create(did, keypair)
    await this.ctx.actorStore.transact(did, (store) =>
      store.repo.createRepo([], rev),
    )
    if (this.ctx.entrywayAdminAgent) {
      await this.ctx.entrywayAdminAgent.api.com.atproto.admin.updateAccountSigningKey(
        {
          did,
          signingKey: keypair.did(),
        },
      )
    } else {
      await this.ctx.plcClient.updateAtprotoKey(
        did,
        this.ctx.plcRotationKey,
        keypair.did(),
      )
    }
  }

  processTombstone(evt: TombstoneEvt) {
    const did = evt.did
    this.addToUserQueue(did, async () => {
      await this.ctx.actorStore.destroy(did)
      await this.ctx.accountManager.deleteAccount(did)
    })
  }
}

const parseEvtToWrites = async (evt: CommitEvt): Promise<PreparedWrite[]> => {
  const did = evt.repo
  const evtCar = await readCar(evt.blocks)
  const writesUnfiltered = await Promise.all(
    evt.ops.map(async (op) => {
      const { collection, rkey } = parseDataKey(op.path)
      if (op.action === 'delete') {
        return prepareDelete({ did, collection, rkey })
      }
      if (!op.cid) return undefined
      const recordBytes = evtCar.blocks.get(op.cid)
      if (!recordBytes) return undefined
      const record = cborToLexRecord(recordBytes)

      if (op.action === 'create') {
        return prepareCreate({
          did,
          collection,
          rkey,
          record,
          validate: false,
        })
      } else {
        return prepareUpdate({
          did,
          collection,
          rkey,
          record,
          validate: false,
        })
      }
    }),
  )
  return filterDefined(writesUnfiltered)
}

import { cborToLexRecord, parseDataKey, readCar } from '@atproto/repo'
import { filterDefined } from '@atproto/common'
import AppContext from '../../context'
import { CommitEvt, TombstoneEvt, SeqEvt } from '../../sequencer'
import {
  PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../../repo'
import { Secp256k1Keypair } from '@atproto/crypto'
import { UserQueues } from './user-queues'

export class Recoverer {
  cursor: number
  queues: UserQueues

  constructor(
    public ctx: AppContext,
    opts: { cursor: number; concurrency: number },
  ) {
    this.cursor = opts.cursor
    this.queues = new UserQueues(opts.concurrency)
  }

  async run() {
    let done = false
    while (!done) {
      done = await this.loadNextPage()
      await this.queues.onEmpty()
    }
    await this.queues.processAll()
  }

  async processAll() {
    await this.queues.processAll()
  }

  async destroy() {
    await this.queues.destroy
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
    this.queues.addToUser(did, async () => {
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
    this.queues.addToUser(did, async () => {
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

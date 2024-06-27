import { BlockMap, cborToLexRecord, parseDataKey, readCar } from '@atproto/repo'
import AppContext from '../../context'
import { CommitEvt, SeqEvt, AccountEvt } from '../../sequencer'
import {
  PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../../repo'
import { Secp256k1Keypair } from '@atproto/crypto'
import { UserQueues } from './user-queues'
import { AccountStatus } from '../../account-manager'

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
    await this.queues.destroy()
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
    if (evt.type === 'account') {
      this.processAccountEvt(evt.evt)
    }
    if (evt.type === 'commit') {
      this.processCommit(evt.evt)
    }
  }

  processCommit(evt: CommitEvt) {
    const did = evt.repo
    this.queues.addToUser(did, async () => {
      const { writes, blocks } = await parseCommitEvt(evt)
      if (evt.since === null) {
        // bails if actor store already exists
        await this.processRepoCreation(did, evt.rev)
      }
      await this.ctx.actorStore.transact(did, async (actorTxn) => {
        const root = await actorTxn.repo.storage.getRootDetailed()
        if (root.rev >= evt.rev) {
          return
        }
        const commit = await actorTxn.repo.formatCommit(writes)
        commit.newBlocks = blocks
        commit.cid = evt.commit
        commit.rev = evt.rev
        await Promise.all([
          actorTxn.repo.storage.applyCommit(commit),
          actorTxn.repo.indexWrites(writes, commit.rev),
          actorTxn.repo.blob.processWriteBlobs(commit.rev, writes),
        ])
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
    console.log(`created repo and keypair for ${did}`)
  }

  async updateAccountSigningKey(did: string, signingKey: string) {
    if (this.ctx.entrywayAdminAgent) {
      await this.ctx.entrywayAdminAgent.api.com.atproto.admin.updateAccountSigningKey(
        {
          did,
          signingKey,
        },
      )
    } else {
      await this.ctx.plcClient.updateAtprotoKey(
        did,
        this.ctx.plcRotationKey,
        signingKey,
      )
    }
  }

  processAccountEvt(evt: AccountEvt) {
    if (evt.status !== AccountStatus.Deleted) {
      return
    }
    const did = evt.did
    this.queues.addToUser(did, async () => {
      await this.ctx.actorStore.destroy(did)
      await this.ctx.accountManager.deleteAccount(did)
    })
  }
}

const parseCommitEvt = async (
  evt: CommitEvt,
): Promise<{
  writes: PreparedWrite[]
  blocks: BlockMap
}> => {
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
  const writes = writesUnfiltered.filter(
    (w) => w !== undefined,
  ) as PreparedWrite[]
  return {
    writes,
    blocks: evtCar.blocks,
  }
}

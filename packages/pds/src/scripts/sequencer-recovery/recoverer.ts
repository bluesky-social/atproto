import { rmIfExists } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  BlockMap,
  CidSet,
  CommitData,
  WriteOpAction,
  cborToLexRecord,
  parseDataKey,
  readCar,
} from '@atproto/repo'
import {
  AccountManager,
  AccountStatus,
} from '../../account-manager/account-manager'
import { ActorStore } from '../../actor-store/actor-store'
import { ActorStoreTransactor } from '../../actor-store/actor-store-transactor'
import { countAll } from '../../db'
import {
  PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../../repo'
import { AccountEvt, CommitEvt, SeqEvt, Sequencer } from '../../sequencer'
import { RecoveryDb } from './recovery-db'
import { UserQueues } from './user-queues'

export type RecovererContextNoDb = {
  sequencer: Sequencer
  accountManager: AccountManager
  actorStore: ActorStore
}

export type RecovererContext = RecovererContextNoDb & {
  recoveryDb: RecoveryDb
}

const PAGE_SIZE = 5000

export class Recoverer {
  queues: UserQueues
  failed: Set<string>

  constructor(
    public ctx: RecovererContext,
    opts: { concurrency: number },
  ) {
    this.queues = new UserQueues(opts.concurrency)
    this.failed = new Set()
  }

  async run(startCursor = 0) {
    const failed = await this.ctx.recoveryDb.db
      .selectFrom('failed')
      .select('did')
      .execute()
    for (const row of failed) {
      this.failed.add(row.did)
    }

    const totalRes = await this.ctx.sequencer.db.db
      .selectFrom('repo_seq')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    const totalEvts = totalRes.count
    let completed = 0

    let cursor: number | undefined = startCursor
    while (cursor !== undefined) {
      const page = await this.ctx.sequencer.requestSeqRange({
        earliestSeq: cursor,
        limit: PAGE_SIZE,
      })
      page.forEach((evt) => this.processEvent(evt))
      cursor = page.at(-1)?.seq

      await this.queues.onEmpty()

      completed += PAGE_SIZE
      const percentComplete = (completed / totalEvts) * 100
      console.log(`${percentComplete.toFixed(2)}% - ${cursor}`)
    }

    await this.queues.processAll()
  }

  async processAll() {
    await this.queues.processAll()
  }

  async destroy() {
    await this.queues.destroy()
  }

  processEvent(evt: SeqEvt) {
    const did = didFromEvt(evt)
    if (!did) {
      return
    }
    this.queues.addToUser(did, async () => {
      if (this.failed.has(did)) {
        return
      }
      await processSeqEvt(this.ctx, evt).catch(async (err) => {
        this.failed.add(did)
        await trackFailure(this.ctx.recoveryDb, did, err)
      })
    })
  }
}

export const processSeqEvt = async (ctx: RecovererContext, evt: SeqEvt) => {
  // only need to process commits & tombstones
  if (evt.type === 'account') {
    await processAccountEvt(ctx, evt.evt)
  }
  if (evt.type === 'commit') {
    await processCommit(ctx, evt.evt).catch()
  }
}

const processCommit = async (ctx: RecovererContext, evt: CommitEvt) => {
  const did = evt.repo
  const { writes, blocks } = await parseCommitEvt(evt)
  if (evt.since === null) {
    const actorExists = await ctx.actorStore.exists(did)
    if (!actorExists) {
      await processRepoCreation(ctx, evt, writes, blocks)
      return
    }
  }
  await ctx.actorStore.transact(did, async (actorTxn) => {
    const root = await actorTxn.repo.storage.getRootDetailed()
    if (root.rev >= evt.rev) {
      return
    }
    const commit = await actorTxn.repo.formatCommit(writes)
    commit.newBlocks = blocks
    commit.cid = evt.commit
    commit.rev = evt.rev
    await actorTxn.repo.storage.applyCommit(commit)
    await actorTxn.repo.indexWrites(writes, commit.rev)
    await trackBlobs(actorTxn, writes)
  })
}

const processRepoCreation = async (
  ctx: RecovererContext,
  evt: CommitEvt,
  writes: PreparedWrite[],
  blocks: BlockMap,
) => {
  const did = evt.repo
  const keypair = await Secp256k1Keypair.create({ exportable: true })
  await ctx.actorStore.create(did, keypair)
  const commit: CommitData = {
    cid: evt.commit,
    rev: evt.rev,
    since: evt.since,
    prev: null,
    newBlocks: blocks,
    relevantBlocks: new BlockMap(),
    removedCids: new CidSet(),
  }
  await ctx.actorStore.transact(did, async (actorTxn) => {
    await actorTxn.repo.storage.applyCommit(commit, true)
    await actorTxn.repo.indexWrites(writes, commit.rev)
    await actorTxn.repo.blob.processWriteBlobs(commit.rev, writes)
  })
  await trackNewAccount(ctx.recoveryDb, did)
}

const processAccountEvt = async (ctx: RecovererContext, evt: AccountEvt) => {
  // do not need to process deactivation/takedowns because we backup account DB as well
  if (evt.status !== AccountStatus.Deleted) {
    return
  }
  const { directory } = await ctx.actorStore.getLocation(evt.did)
  await rmIfExists(directory, true)
  await ctx.accountManager.deleteAccount(evt.did)
}

const trackBlobs = async (
  store: ActorStoreTransactor,
  writes: PreparedWrite[],
) => {
  await store.repo.blob.deleteDereferencedBlobs(writes)

  for (const write of writes) {
    if (
      write.action === WriteOpAction.Create ||
      write.action === WriteOpAction.Update
    ) {
      for (const blob of write.blobs) {
        await store.repo.blob.insertBlobMetadata(blob)
        await store.repo.blob.associateBlob(blob, write.uri)
      }
    }
  }
}

const trackFailure = async (
  recoveryDb: RecoveryDb,
  did: string,
  err: unknown,
) => {
  await recoveryDb.db
    .insertInto('failed')
    .values({
      did,
      error: err?.toString(),
      fixed: 0,
    })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

const trackNewAccount = async (recoveryDb: RecoveryDb, did: string) => {
  await recoveryDb.db
    .insertInto('new_account')
    .values({
      did,
      published: 0,
    })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

const parseCommitEvt = async (
  evt: CommitEvt,
): Promise<{
  writes: PreparedWrite[]
  blocks: BlockMap
}> => {
  const did = evt.repo
  const evtCar = await readCar(evt.blocks, { skipCidVerification: true })
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

const didFromEvt = (evt: SeqEvt): string | null => {
  if (evt.type === 'account') {
    return evt.evt.did
  } else if (evt.type === 'commit') {
    return evt.evt.repo
  } else {
    return null
  }
}

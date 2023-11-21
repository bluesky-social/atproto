import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import AppContext from '../context'
import { forEachActorStore } from '../actor-store/migrate'
import { envToCfg, envToSecrets, readEnv } from '../config'
import { ActorStoreReader, ActorStoreTransactor } from '../actor-store'
import { CommitData, Repo } from '@atproto/repo'
import { TID } from '@atproto/common'

dotenv.config()

const MISSING_BLOB_FILE = '/data/missing-blobs.txt'
const MISSING_ACTOR_FILE = '/data/missing-actor.txt'

const run = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)

  let count = 0

  await forEachActorStore(
    ctx,
    { concurrency: 100 },
    async (ctx: AppContext, did: string) => {
      let needsCommit: boolean
      try {
        needsCommit = await ctx.actorStore.read(did, async (store) => {
          await trackMissingBlobs(store)
          return checkNeedsCommit(store)
        })
      } catch (err) {
        await fs.appendFile(MISSING_ACTOR_FILE, `${did}\n`)
        needsCommit = false
      }
      if (needsCommit) {
        const commit = await ctx.actorStore.transact(did, async (store) =>
          resignCommit(store),
        )
        await ctx.sequencer.sequenceCommit(did, commit, [])
      }
      count++
      if (count % 100 === 0) {
        console.log(count)
      }
    },
  )
}

const trackMissingBlobs = async (store: ActorStoreReader) => {
  const missingBlobs = await store.db.db
    .selectFrom('record_blob')
    .whereNotExists((qb) =>
      qb
        .selectFrom('blob')
        .where('blob.cid', '=', 'record_blob.cid')
        .select('cid'),
    )
    .leftJoin('blob', 'blob.cid', 'record_blob.blobCid')
    .where('blob.cid', 'is', null)
    .select('record_blob.blobCid')
    .execute()
  for (const blob of missingBlobs) {
    await fs.appendFile(MISSING_BLOB_FILE, `${store.did} ${blob.blobCid}\n`)
  }
}

const checkNeedsCommit = async (store: ActorStoreReader): Promise<boolean> => {
  const revs = await store.db.db
    .selectFrom('repo_block')
    .select('repoRev')
    .distinct()
    .limit(2)
    .execute()
  return revs.length < 2
}

const resignCommit = async (
  store: ActorStoreTransactor,
): Promise<CommitData> => {
  const repo = await Repo.load(store.repo.storage)
  const commit = await repo.formatResignCommit(
    TID.nextStr(),
    store.repo.signingKey,
  )
  await repo.applyCommit(commit)
  return commit
}

run()

import fs from 'fs/promises'
import dotenv from 'dotenv'
import { BlobStore, Repo } from '@atproto/repo'
import { ActorStoreTransactor } from '../actor-store'
import { SqlRepoTransactor } from '../actor-store/repo/sql-repo-transactor'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { findBlobRefs } from '../api/com/atproto/temp/importRepo'
import { BlobRef } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'

dotenv.config()

const MISSING_IN_STORE = 'store.txt'
const MISSING_IN_TABLE = 'table.txt'

const run = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const dids = await ctx.accountManager.db.db
    .selectFrom('actor')
    .selectAll()
    .execute()
  let count = 0
  for (const row of dids) {
    await ctx.actorStore.transact(row.did, async (store) => {
      await fixRepoBlobs(ctx, store, row.did)
    })
    count++
    console.log(count)
  }
}

const fixRepoBlobs = async (
  ctx: AppContext,
  store: ActorStoreTransactor,
  did: string,
) => {
  await store.db.db.deleteFrom('record_blob').execute()
  const storage = new SqlRepoTransactor(store.db, did)
  const root = await storage.getRoot()
  const repo = await Repo.load(storage, root)
  let blobRefs: BlobRef[] = []
  for await (const record of repo.walkRecords()) {
    const recordRefs = findBlobRefs(record)
    const uri = AtUri.make(did, record.collection, record.rkey)
    const toInsert = recordRefs.map((ref) => ({
      recordUri: uri.toString(),
      blobCid: ref.ref.toString(),
    }))
    await store.db.db.insertInto('record_blob').values(toInsert).execute()
    blobRefs = blobRefs.concat(recordRefs)
  }
  const blobstore = ctx.blobstore(did)
  await Promise.all(
    blobRefs.map((ref) => checkBlob(store, blobstore, did, ref)),
  )
}

const checkBlob = async (
  store: ActorStoreTransactor,
  blobstore: BlobStore,
  did: string,
  ref: BlobRef,
) => {
  const [stored, tracked] = await Promise.all([
    blobstore.hasStored(ref.ref),
    store.db.db
      .selectFrom('blob')
      .where('cid', '=', ref.ref.toString())
      .selectAll()
      .executeTakeFirst(),
  ])
  if (stored && tracked) {
    if (tracked) {
      return
    } else {
      await fs.appendFile(MISSING_IN_TABLE, `${did} ${ref.ref.toString()}\n`)
    }
  }
  await fs.appendFile(MISSING_IN_STORE, `${did}, ${ref.ref.toString()}`)
}

run()

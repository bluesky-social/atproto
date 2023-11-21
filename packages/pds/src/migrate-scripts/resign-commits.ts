import dotenv from 'dotenv'
import AppContext from '../context'
import { forEachActorStore } from '../actor-store/migrate'
import { envToCfg, envToSecrets, readEnv } from '../config'
import { ActorStoreReader, ActorStoreTransactor } from '../actor-store'
import { CommitData, Repo } from '@atproto/repo'
import { TID, wait } from '@atproto/common'

dotenv.config()

const run = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)

  let total = 0
  let resigned = 0

  await forEachActorStore(
    ctx,
    { concurrency: 1 },
    async (ctx: AppContext, did: string) => {
      let needsCommit: boolean
      try {
        needsCommit = await ctx.actorStore.read(did, async (store) => {
          return checkNeedsCommit(store)
        })
      } catch {
        needsCommit = false
      }
      if (needsCommit) {
        const commit = await ctx.actorStore.transact(did, async (store) =>
          resignCommit(store),
        )
        await ctx.sequencer.sequenceCommit(did, commit, [])
        resigned++
        await wait(10)
      }
      total++
      if (total % 100 === 0) {
        console.log('Total: ', total)
        console.log('Resigned: ', resigned)
      }
    },
  )
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

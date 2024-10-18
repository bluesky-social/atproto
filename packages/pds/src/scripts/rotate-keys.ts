import fs from 'node:fs/promises'
import PQueue from 'p-queue'
import { CommitData } from '@atproto/repo'
import AppContext from '../context'
import { parseIntArg } from './util'

export const rotateKeys = async (ctx: AppContext, args: string[]) => {
  const dids = args
  await rotateKeysForRepos(ctx, dids, 10)
}

export const rotateKeysMany = async (ctx: AppContext, args: string[]) => {
  const filepath = args[0]
  if (!filepath) {
    throw new Error('Expected filepath as argument')
  }
  const concurrency = args[1] ? parseIntArg(args[1]) : 25
  const file = await fs.readFile(filepath)
  const dids = file
    .toString()
    .split('\n')
    .map((did) => did.trim())
    .filter((did) => did.startsWith('did:plc'))

  await rotateKeysForRepos(ctx, dids, concurrency)
}

const rotateKeysForRepos = async (
  ctx: AppContext,
  dids: string[],
  concurrency: number,
) => {
  const queue = new PQueue({ concurrency })
  for (const did of dids) {
    queue.add(async () => {
      try {
        await updatePlcSigningKey(ctx, did)
      } catch (err) {
        console.error(`failed to update key for ${did}: ${err}`)
        return
      }
      let commit: CommitData
      try {
        commit = await ctx.actorStore.transact(did, async (actorTxn) => {
          return actorTxn.repo.processWrites([])
        })
      } catch (err) {
        console.error(`failed to write new commit for ${did}: ${err}`)
        return
      }
      try {
        await ctx.sequencer.sequenceCommit(did, commit, [])
      } catch (err) {
        console.error(`failed to sequence new commit for ${did}: ${err}`)
        return
      }
      console.log(`successfully updated key for ${did}`)
    })
  }
  await queue.onIdle()
}

const updatePlcSigningKey = async (ctx: AppContext, did: string) => {
  const updateTo = await ctx.actorStore.keypair(did)
  const currSigningKey = await ctx.idResolver.did.resolveAtprotoKey(did, true)
  if (updateTo.did() === currSigningKey) {
    // already up to date
    return
  }
  if (ctx.entrywayAdminAgent) {
    await ctx.entrywayAdminAgent.api.com.atproto.admin.updateAccountSigningKey({
      did,
      signingKey: updateTo.did(),
    })
  } else {
    await ctx.plcClient.updateAtprotoKey(
      did,
      ctx.plcRotationKey,
      updateTo.did(),
    )
  }
}

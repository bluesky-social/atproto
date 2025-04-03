import fs from 'node:fs/promises'
import * as plc from '@did-plc/lib'
import PQueue from 'p-queue'
import AtpAgent from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { ActorStore } from '../actor-store/actor-store'
import { SyncEvtData } from '../repo'
import { Sequencer } from '../sequencer'
import { getRecoveryDbFromSequencerLoc } from './sequencer-recovery/recovery-db'
import { parseIntArg } from './util'

export type RotateKeysContext = {
  sequencer: Sequencer
  actorStore: ActorStore
  idResolver: IdResolver
  plcClient: plc.Client
  plcRotationKey: Keypair
  entrywayAdminAgent?: AtpAgent
}

export const rotateKeys = async (ctx: RotateKeysContext, args: string[]) => {
  const dids = args
  await rotateKeysForRepos(ctx, dids, 10)
}

export const rotateKeysFromFile = async (
  ctx: RotateKeysContext,
  args: string[],
) => {
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

export const rotateKeysRecovery = async (
  ctx: RotateKeysContext,
  args: string[],
) => {
  const concurrency = args[1] ? parseIntArg(args[0]) : 10

  const recoveryDb = await getRecoveryDbFromSequencerLoc(
    ctx.sequencer.dbLocation,
  )
  const rows = await recoveryDb.db
    .selectFrom('new_account')
    .select('did')
    .where('new_account.published', '=', 0)
    .execute()
  const dids = rows.map((r) => r.did)

  await rotateKeysForRepos(ctx, dids, concurrency, async (did) => {
    await recoveryDb.db
      .updateTable('new_account')
      .set({ published: 1 })
      .where('did', '=', did)
      .execute()
  })
}

const rotateKeysForRepos = async (
  ctx: RotateKeysContext,
  dids: string[],
  concurrency: number,
  onSuccess?: (did: string) => Promise<void>,
) => {
  const queue = new PQueue({ concurrency })
  let completed = 0
  for (const did of dids) {
    queue.add(async () => {
      try {
        await updatePlcSigningKey(ctx, did)
      } catch (err) {
        console.error(`failed to update key for ${did}: ${err}`)
        return
      }
      let syncData: SyncEvtData
      try {
        syncData = await ctx.actorStore.transact(did, async (actorTxn) => {
          await actorTxn.repo.processWrites([])
          return actorTxn.repo.getSyncEventData()
        })
      } catch (err) {
        console.error(`failed to write new commit for ${did}: ${err}`)
        return
      }
      try {
        await ctx.sequencer.sequenceIdentityEvt(did)
      } catch (err) {
        console.error(`failed to sequence new identity evt for ${did}: ${err}`)
        return
      }
      try {
        await ctx.sequencer.sequenceSyncEvt(did, syncData)
      } catch (err) {
        console.error(`failed to sequence for ${did}: ${err}`)
        return
      }
      if (onSuccess) {
        await onSuccess(did)
      }
      completed++
      if (completed % 10 === 0) {
        console.log(`${completed}/${dids.length}`)
      }
    })
  }
  await queue.onIdle()
  console.log('DONE')
}

const updatePlcSigningKey = async (ctx: RotateKeysContext, did: string) => {
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

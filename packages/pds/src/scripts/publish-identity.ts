import fs from 'node:fs/promises'
import { wait } from '@atproto/common'
import { Sequencer } from '../sequencer'
import { getAndMigrateRecoveryDb } from './sequencer-recovery/recovery-db'
import { parseIntArg } from './util'

type Context = {
  sequencer: Sequencer
}

export const publishIdentity = async (ctx: Context, args: string[]) => {
  const dids = args
  await publishIdentityEvtForDids(ctx, dids)
  console.log('DONE')
}

export const publishIdentityMany = async (ctx: Context, args: string[]) => {
  const filepath = args[0]
  if (!filepath) {
    throw new Error('Expected filepath as argument')
  }
  const timeBetween = args[1] ? parseIntArg(args[1]) : 5
  const file = await fs.readFile(filepath)
  const dids = file
    .toString()
    .split('\n')
    .map((did) => did.trim())
    .filter((did) => did.startsWith('did:plc'))

  await publishIdentityEvtForDids(ctx, dids, timeBetween)
  console.log('DONE')
}

export const publishIdentityEvtForDids = async (
  ctx: Context,
  dids: string[],
  timeBetween = 0,
) => {
  for (const did of dids) {
    try {
      await ctx.sequencer.sequenceIdentityEvt(did)
      console.log(`published identity evt for ${did}`)
    } catch (err) {
      console.error(`failed to sequence new identity evt for ${did}: ${err}`)
    }
    if (timeBetween > 0) {
      await wait(timeBetween)
    }
  }
}

export const publishIdentityRecovery = async (ctx: Context, args: string[]) => {
  const filepath = args[0]
  if (!filepath) {
    throw new Error('Expected filepath as argument')
  }
  const timeBetween = args[1] ? parseIntArg(args[1]) : 5

  const db = await getAndMigrateRecoveryDb(filepath)
  const rows = await db.db
    .selectFrom('new_account')
    .select('did')
    .where('new_account.published', '=', 0)
    .execute()
  const dids = rows.map((r) => r.did)

  let published = 0
  for (const did of dids) {
    try {
      await ctx.sequencer.sequenceIdentityEvt(did)
      await db.db
        .updateTable('new_account')
        .set({ published: 1 })
        .where('did', '=', did)
        .execute()
      console.log(`published identity evt for ${did}`)
    } catch (err) {
      console.error(`failed to sequence new identity evt for ${did}: ${err}`)
    }
    if (timeBetween > 0) {
      await wait(timeBetween)
    }
    published++
    if (published % 10 === 0) {
      console.log(`${published}/${dids.length}`)
    }
  }
  console.log('DONE')
}

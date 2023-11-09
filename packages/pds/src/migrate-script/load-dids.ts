import { chunkArray } from '@atproto/common'
import { setupEnv } from './util'

const run = async () => {
  const amount = parseInt(process.argv[2])
  console.log(`loading next ${amount} dids`)
  const { db, ctx } = await setupEnv()

  const didsRes = await ctx.db.db
    .selectFrom('user_account')
    .select('did')
    .where('pdsId', 'is', null)
    .orderBy('did', 'asc')
    .limit(amount)
    .execute()
  const dids = didsRes.map((row, i) => ({
    did: row.did,
    phase: 0,
    pdsId: (i % 2) + 1,
    failed: 0 as const,
  }))

  await Promise.all(
    chunkArray(dids, 50).map((chunk) =>
      db
        .insertInto('status')
        .values(chunk)
        .onConflict((oc) => oc.doNothing())
        .execute(),
    ),
  )
}

run()

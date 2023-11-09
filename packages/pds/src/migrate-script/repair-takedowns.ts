import { getPds, setupEnv, transferTakedowns } from './util'

export const runScript = async () => {
  const { db, ctx, pdsInfos, adminHeaders } = await setupEnv()
  const failed = await db
    .selectFrom('failed_takedown')
    .innerJoin('status', 'status.did', 'failed_takedown.did')
    .groupBy('failed_takedown.did')
    .select(['failed_takedown.did', 'status.pdsId'])
    .execute()
  let count = 0
  for (const takedown of failed) {
    const pdsInfo = getPds(pdsInfos, takedown.pdsId ?? -1)
    try {
      await transferTakedowns(ctx, db, pdsInfo, takedown.did, adminHeaders)
      await db
        .deleteFrom('failed_takedown')
        .where('did', '=', takedown.did)
        .execute()
    } catch (err) {
      console.log(err)
    }
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

runScript()

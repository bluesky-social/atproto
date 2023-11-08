import { getPds, repairPrefs, setupEnv } from './util'

export const runScript = async () => {
  const { db, ctx, pdsInfos } = await setupEnv()
  const failed = await db
    .selectFrom('failed_pref')
    .innerJoin('status', 'status.did', 'failed_pref.did')
    .selectAll()
    .execute()
  let count = 0
  for (const pref of failed) {
    const pdsInfo = getPds(pdsInfos, pref.pdsId ?? -1)
    try {
      await repairPrefs(ctx, db, pdsInfo, pref.did)
    } catch (err) {
      console.log(err)
    }
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

runScript()

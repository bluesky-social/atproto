import { getPds, repairBlob, setupEnv } from './util'

export const runScript = async () => {
  const { db, ctx, adminHeaders, pdsInfos } = await setupEnv()
  const failed = await db
    .selectFrom('failed_blob')
    .innerJoin('status', 'status.did', 'failed_blob.did')
    .selectAll()
    .execute()
  let count = 0
  for (const blob of failed) {
    const pdsInfo = getPds(pdsInfos, blob.pdsId ?? -1)
    try {
      await repairBlob(ctx, db, pdsInfo, blob.did, blob.cid, adminHeaders)
    } catch (err) {
      console.log(err)
    }
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

runScript()

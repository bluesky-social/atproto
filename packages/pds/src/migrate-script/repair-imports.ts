import PQueue from 'p-queue'
import { doImport, getPds, setupEnv } from './util'

export const runScript = async () => {
  const { db, ctx, adminHeaders, pdsInfos } = await setupEnv()
  const failed = await db
    .selectFrom('failed_import')
    .innerJoin('status', 'status.did', 'failed_import.did')
    .select(['status.did', 'status.pdsId'])
    .execute()
  let count = 0
  const importQueue = new PQueue({ concurrency: 1 })
  for (const account of failed) {
    importQueue.add(async () => {
      const pdsInfo = getPds(pdsInfos, account.pdsId ?? -1)
      try {
        await doImport(ctx, db, pdsInfo, account.did, adminHeaders)
        await db
          .deleteFrom('failed_import')
          .where('did', '=', account.did)
          .execute()
      } catch (err) {
        console.log(err)
      }
      count++
      console.log(`${count}/${failed.length}`)
    })
  }
  await importQueue.onIdle()
  console.log('DONE WITH ALL')
}

runScript()

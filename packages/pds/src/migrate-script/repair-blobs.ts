import PQueue from 'p-queue'
import { getPds, repairBlob, setupEnv } from './util'

type FailedBlob = {
  did: string
  cid: string
  pdsId: number
}

export const runScript = async () => {
  const { db, ctx, adminHeaders, pdsInfos } = await setupEnv()
  const failed = await db
    .selectFrom('failed_blob')
    .innerJoin('status', 'status.did', 'failed_blob.did')
    .selectAll()
    .execute()
  let count = 0
  const failedByDid = failed.reduce((acc, cur) => {
    acc[cur.did] ??= []
    acc[cur.did].push({ did: cur.did, cid: cur.cid, pdsId: cur.pdsId ?? -1 })
    return acc
  }, {} as Record<string, FailedBlob[]>)
  const blobQueue = new PQueue({ concurrency: 40 })
  for (const did of Object.keys(failedByDid)) {
    const failedBlobs = failedByDid[did] ?? []
    blobQueue.add(async () => {
      for (const blob of failedBlobs) {
        const pdsInfo = getPds(pdsInfos, blob.pdsId ?? -1)
        try {
          await repairBlob(ctx, db, pdsInfo, blob.did, blob.cid, adminHeaders)
        } catch (err) {
          console.log(err)
        }
        count++
        console.log(`${count}/${failed.length}`)
      }
    })
  }
  await blobQueue.onIdle()
  console.log('DONE WITH ALL')
}

runScript()

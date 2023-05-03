import AppContext from '../context'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder } from '../image/uri'

async function main(ctx: AppContext) {
  const db = ctx.db
  const { ref } = db.db.dynamic
  const deletedRepoBlobs = await db.db
    .deleteFrom('repo_blob')
    .whereNotExists(
      db.db
        .selectFrom('record')
        .whereRef('record.uri', '=', ref('repo_blob.recordUri'))
        .selectAll(),
    )
    .returningAll()
    .execute()

  const byUser = deletedRepoBlobs.reduce((acc, cur) => {
    acc[cur.did] ??= []
    acc[cur.did].push(cur.cid)
    return acc
  }, {} as Record<string, string[]>)

  let allDeletedDbBlobs: string[] = []

  for (const did of Object.keys(byUser)) {
    const deletedRepoBlobs = byUser[did]
    if (deletedRepoBlobs.length < 1) continue
    const duplicateCidsRes = await db.db
      .selectFrom('repo_blob')
      .where('did', '=', did)
      .where('cid', 'in', deletedRepoBlobs)
      .select('cid')
      .execute()
    const duplicateCids = duplicateCidsRes.map((row) => row.cid)
    const cidsToDelete = deletedRepoBlobs.filter(
      (cid) => !duplicateCids.includes(cid),
    )
    if (cidsToDelete.length < 1) continue
    const deletedDbBlobsRes = await db.db
      .deleteFrom('blob')
      .where('creator', '=', did)
      .where('cid', 'in', cidsToDelete)
      .returningAll()
      .execute()
    const deletedDbBlobCids = deletedDbBlobsRes.map((row) => row.cid)
    allDeletedDbBlobs = [...allDeletedDbBlobs, ...deletedDbBlobCids]
  }

  const stillExistingChunks = await Promise.all(
    chunkArray(allDeletedDbBlobs, 100).map(async (chunk) => {
      const res = await db.db
        .selectFrom('blob')
        .where('cid', 'in', chunk)
        .select('cid')
        .execute()
      return res.map((row) => row.cid)
    }),
  )
  const stillExisting = stillExistingChunks.flat()
  const toDeleteBlobs = allDeletedDbBlobs.filter(
    (cid) => !stillExisting.includes(cid),
  )
  const chunks = chunkArray(toDeleteBlobs, 100)
  for (const chunk of chunks) {
    await Promise.all([
      ...chunk.map((cid) => ctx.blobstore.delete(CID.parse(cid))),
      ...chunk.map((cid) => {
        const paths = ImageUriBuilder.commonSignedUris.map((id) => {
          const uri = ctx.imgUriBuilder.getCommonSignedUri(id, cid)
          return uri.replace(ctx.imgUriBuilder.endpoint, '')
        })
        return ctx.imgInvalidator?.invalidate(cid, paths)
      }),
    ])
  }
}

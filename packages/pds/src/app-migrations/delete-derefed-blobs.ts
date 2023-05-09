import AppContext from '../context'
import { cborToLex } from '@atproto/repo'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { AtUri } from '@atproto/uri'
import { dedupe } from '../labeler/util'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder } from '../image/uri'
import Database from '../db'

export async function migration(ctx: AppContext) {
  await derefedRecords(ctx.db)
  console.log('deleted derefed records')

  await derefedProfiles(ctx.db)
  console.log('deleted derefed profiles')
  const { ref } = ctx.db.db.dynamic

  const toDeleteDbBlobs = await ctx.db.db
    .selectFrom('blob')
    .whereNotExists(
      ctx.db.db
        .selectFrom('repo_blob')
        .whereRef('repo_blob.did', '=', ref('blob.creator'))
        .whereRef('repo_blob.cid', '=', ref('blob.cid'))
        .selectAll(),
    )
    .selectAll()
    .execute()

  const toDeleteDbBlobCids = dedupe(toDeleteDbBlobs.map((row) => row.cid))

  const stillExistingChunks = await Promise.all(
    chunkArray(toDeleteDbBlobCids, 100).map(async (chunk) => {
      const res = await ctx.db.db
        .selectFrom('blob')
        .where('cid', 'in', chunk)
        .select('cid')
        .execute()
      return res.map((row) => row.cid)
    }),
  )
  const stillExisting = stillExistingChunks.flat()

  const toDeleteBlobs = toDeleteDbBlobCids.filter(
    (cid) => !stillExisting.includes(cid),
  )

  console.log(`deleting ${toDeleteBlobs.length} blobs`)

  const chunks = chunkArray(toDeleteBlobs, 100)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log('deleting chunk: ', i)
    const res = await Promise.allSettled([
      ...chunk.map((cid) => ctx.blobstore.quarantine(CID.parse(cid))),
      ...chunk.map((cid) => {
        const paths = ImageUriBuilder.commonSignedUris.map((id) => {
          const uri = ctx.imgUriBuilder.getCommonSignedUri(id, cid)
          return uri.replace(ctx.imgUriBuilder.endpoint, '')
        })
        return ctx.imgInvalidator?.invalidate(cid, paths)
      }),
    ])
    const rejected = res.filter((r) => r.status === 'rejected')
    for (const res of rejected) {
      if (res.status === 'rejected') {
        console.log(res.reason)
      }
    }
  }

  console.log('finished quarantining & invalidating')

  // await ctx.db.db
  //   .deleteFrom('blob')
  //   .whereNotExists(
  //     ctx.db.db
  //       .selectFrom('repo_blob')
  //       .whereRef('repo_blob.did', '=', ref('blob.creator'))
  //       .whereRef('repo_blob.cid', '=', ref('blob.cid'))
  //       .selectAll(),
  //   )
  //   .execute()

  console.log('all done!')
}

async function derefedRecords(dbTxn: Database) {
  const { ref } = dbTxn.db.dynamic
  await dbTxn.db
    .deleteFrom('repo_blob')
    .whereNotExists(
      dbTxn.db
        .selectFrom('record')
        .whereRef('record.uri', '=', ref('repo_blob.recordUri'))
        .selectAll(),
    )
    .returningAll()
    .execute()
}

async function derefedProfiles(dbTxn: Database) {
  const profilesRes = await dbTxn.db
    .selectFrom('did_handle')
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .leftJoin('ipld_block', (join) =>
      join
        .onRef('ipld_block.creator', '=', 'profile.creator')
        .onRef('ipld_block.cid', '=', 'profile.cid'),
    )
    .select(['did_handle.did as did', 'ipld_block.content as content'])
    .execute()

  const profileBlobs = profilesRes.reduce((acc, cur) => {
    if (cur.content === null) {
      acc[cur.did] = []
      return acc
    }
    const record = cborToLex(cur.content) as ProfileRecord
    acc[cur.did] ??= []
    if (record.avatar) {
      acc[cur.did].push(record.avatar.ref.toString())
    }
    if (record.banner) {
      acc[cur.did].push(record.banner.ref.toString())
    }
    return acc
  }, {} as Record<string, string[]>)

  for (const did of Object.keys(profileBlobs)) {
    const uri = AtUri.make(did, 'app.bsky.actor.profile', 'self').toString()
    const cids = profileBlobs[did]
    let builder = dbTxn.db
      .deleteFrom('repo_blob')
      .where('did', '=', did)
      .where('recordUri', '=', uri)
    if (cids.length > 0) {
      builder = builder.where('cid', 'not in', cids)
    }
    await builder.execute()
  }
}

import AppContext from '../context'
import { cborToLex } from '@atproto/repo'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { AtUri } from '@atproto/uri'
import { dedupe } from '../labeler/util'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder } from '../image/uri'
import Database from '../db'
import { appMigration } from '../db/leader'

const MIGRATION_NAME = '2023-05-08-deleted-blobs-cleanup'

export async function deleteDerefedBlobsMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (_tx) => migration(ctx))
}

async function migration(ctx: AppContext) {
  await derefedRecords(ctx.db)

  await derefedProfiles(ctx.db)
  const { ref } = ctx.db.db.dynamic

  const deletedDbBlobs = await ctx.db.db
    .deleteFrom('blob')
    .whereNotExists(
      ctx.db.db
        .selectFrom('repo_blob')
        .whereRef('repo_blob.did', '=', ref('blob.creator'))
        .whereRef('repo_blob.cid', '=', ref('blob.cid'))
        .selectAll(),
    )
    .returningAll()
    .execute()

  const deletedDbBlobCids = dedupe(deletedDbBlobs.map((row) => row.cid))

  console.log('deleted db blobs')
  for (const row of deletedDbBlobs) {
    console.log(row)
  }

  const stillExistingChunks = await Promise.all(
    chunkArray(deletedDbBlobCids, 100).map(async (chunk) => {
      const res = await ctx.db.db
        .selectFrom('blob')
        .where('cid', 'in', chunk)
        .select('cid')
        .execute()
      return res.map((row) => row.cid)
    }),
  )
  const stillExisting = stillExistingChunks.flat()

  const toDeleteBlobs = deletedDbBlobCids.filter(
    (cid) => !stillExisting.includes(cid),
  )

  console.log(`deleting ${toDeleteBlobs.length} blobs`)
  for (const row of toDeleteBlobs) {
    console.log(row)
  }

  const chunks = chunkArray(toDeleteBlobs, 100)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
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
        console.log('rejected: ', res.reason)
      }
    }
  }

  console.log('finished quarantining & invalidating')
}

async function derefedRecords(dbTxn: Database) {
  const { ref } = dbTxn.db.dynamic
  const res = await dbTxn.db
    .deleteFrom('repo_blob')
    .whereNotExists(
      dbTxn.db
        .selectFrom('record')
        .whereRef('record.uri', '=', ref('repo_blob.recordUri'))
        .selectAll(),
    )
    .returningAll()
    .execute()
  console.log(`deleted derefed records`)
  for (const row of res) {
    console.log(row)
  }
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

  console.log('deleting derefed profiles')
  for (const did of Object.keys(profileBlobs)) {
    const uri = AtUri.make(did, 'app.bsky.actor.profile', 'self').toString()
    const cids = profileBlobs[did]
    let builder = dbTxn.db
      .deleteFrom('repo_blob')
      .where('did', '=', did)
      .where('recordUri', '=', uri)
      .returningAll()
    if (cids.length > 0) {
      builder = builder.where('cid', 'not in', cids)
    }
    const res = await builder.execute()
    for (const row of res) {
      console.log(row)
    }
  }
}

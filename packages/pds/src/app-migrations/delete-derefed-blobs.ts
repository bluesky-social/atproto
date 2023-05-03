import AppContext from '../context'
import { cborToLex } from '@atproto/repo'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { AtUri } from '@atproto/uri'
import { dedupe } from '../labeler/util'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder } from '../image/uri'

export async function migration(ctx: AppContext) {
  await derefedRecords(ctx)
  await derefedProfiles(ctx)

  const db = ctx.db
  const { ref } = db.db.dynamic
  const deletedDbBlobs = await db.db
    .deleteFrom('blob')
    .whereNotExists(
      db.db
        .selectFrom('repo_blob')
        .whereRef('repo_blob.did', '=', ref('blob.creator'))
        .whereRef('repo_blob.cid', '=', ref('blob.cid'))
        .selectAll(),
    )
    .returningAll()
    .execute()

  const deletedDbBlobCids = dedupe(deletedDbBlobs.map((row) => row.cid))

  const stillExistingChunks = await Promise.all(
    chunkArray(deletedDbBlobCids, 100).map(async (chunk) => {
      const res = await db.db
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

async function derefedRecords(ctx: AppContext) {
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

  for (const did of Object.keys(byUser)) {
    const deletedRepoBlobs = byUser[did]
    if (deletedRepoBlobs.length < 1) continue
    await db.db
      .selectFrom('repo_blob')
      .where('did', '=', did)
      .where('cid', 'in', deletedRepoBlobs)
      .select('cid')
      .execute()
  }
}

async function derefedProfiles(ctx: AppContext) {
  const db = ctx.db
  const profilesRes = await db.db
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
    let builder = db.db
      .deleteFrom('repo_blob')
      .where('did', '=', did)
      .where('recordUri', '=', uri)
    if (cids.length > 0) {
      builder = builder.where('cid', 'not in', cids)
    }
    await builder.execute()
  }
}

import express from 'express'
import { z } from 'zod'
import * as util from '../../util.js'
import { delta, IpldStore, Repo, schema } from '@bluesky/common'
import Database from '../../db/index.js'
import { ServerError } from '../../error.js'
import * as subscriptions from '../../subscriptions.js'

const router = express.Router()

export const getRepoReq = z.object({
  did: z.string(),
  from: schema.common.strToCid.optional(),
})
export type GetRepoReq = z.infer<typeof getRepoReq>

router.get('/', async (req, res) => {
  const query = util.checkReqBody(req.query, getRepoReq)
  const { did, from = null } = query
  const repo = await util.loadRepo(res, did)
  const diff = await repo.getDiffCar(from)
  res.status(200).send(Buffer.from(diff))
})

export const postRepoReq = z.object({
  did: z.string(),
})
export type PostRepoReq = z.infer<typeof postRepoReq>

router.post('/:did', async (req, res) => {
  // we don't need auth here because the auth is on the data structure 😎
  const { did } = util.checkReqBody(req.params, postRepoReq)
  const bytes = await util.readReqBytes(req)

  const repo = await util.maybeLoadRepo(res, did)
  const db = util.getDB(res)

  // @TODO: we should do these on a temp in-memory blockstore before merging down to our on-disk one
  if (repo) {
    await repo.loadAndVerifyDiff(bytes, async (evt) => {
      await indexOperation(db, repo.blockstore, did, evt)
    })
    await db.updateRepoRoot(did, repo.cid)
    await subscriptions.notifySubscribers(db, repo)
  } else {
    const blockstore = util.getBlockstore(res)
    const loaded = await Repo.fromCarFile(bytes, blockstore, async (evt) => {
      await indexOperation(db, blockstore, did, evt)
    })
    await db.createRepoRoot(did, loaded.cid)
    await subscriptions.notifySubscribers(db, loaded)
  }
  res.status(200).send()
})

const indexOperation = async (
  db: Database,
  blockstore: IpldStore,
  did: string,
  evt: delta.Event,
): Promise<void> => {
  switch (evt.event) {
    case delta.EventType.AddedObject:
      if (evt.collection === 'posts') {
        const post = await blockstore.get(evt.cid, schema.microblog.post)
        await db.createPost(post, evt.cid)
      } else if (evt.collection === 'interactions') {
        const like = await blockstore.get(evt.cid, schema.microblog.like)
        await db.createLike(like, evt.cid)
      }
      return

    case delta.EventType.UpdatedObject:
      if (evt.collection === 'posts') {
        const post = await blockstore.get(evt.cid, schema.microblog.post)
        await db.updatePost(post, evt.cid)
      } else if (evt.collection === 'interactions') {
        throw new ServerError(
          500,
          "We don't support in place interaction edits yet",
        )
      }
      return

    case delta.EventType.DeletedObject:
      if (evt.collection === 'posts') {
        await db.deletePost(evt.tid.toString(), did, evt.namespace)
      } else if (evt.collection === 'interactions') {
        await db.deleteLike(evt.tid.toString(), did, evt.namespace)
      }
      return

    case delta.EventType.AddedRelationship:
      await db.createFollow(did, evt.did)
      return

    case delta.EventType.DeletedRelationship:
      await db.deleteFollow(did, evt.did)
      return

    case delta.EventType.UpdatedRelationship:
      throw new ServerError(
        500,
        "We don't support in place relationship edits yet",
      )

    case delta.EventType.DeletedNamespace:
      throw new ServerError(
        500,
        "We don't support full deletion of namespaces yet",
      )
    default:
      throw new ServerError(500, 'Unsupported operation')
  }
}

export default router

import express from 'express'
import * as util from '../../../util'
import { getRepoRequest, postRepoRequest } from '@adxp/api'
import { DataDiff, Repo, service } from '@adxp/common'
import Database from '../../../db/index'
import { ServerError } from '../../../error'
import * as subscriptions from '../../../subscriptions'

const router = express.Router()

router.get('/', async (req, res) => {
  const query = util.checkReqBody(req.query, getRepoRequest)
  const { did, from = null } = query
  const repo = await util.loadRepo(res, did)
  const diff = await repo.getDiffCar(from)
  res.status(200).send(Buffer.from(diff))
})

router.post('/:did', async (req, res) => {
  // we don't need auth here because the auth is on the data structure 😎
  const { did } = util.checkReqBody(req.params, postRepoRequest)
  const bytes = await util.readReqBytes(req)

  const db = util.getDB(res)

  // @TODO Add fix something here
  // check to see if we have their username in DB, for indexed queries
  // const haveUsername = await db.isDidRegistered(did)
  // if (!haveUsername) {
  //   const username = await service.getUsernameFromDidNetwork(did)
  //   if (username) {
  //     const [name, host] = username.split('@')
  //     await db.registerDid(name, did, host)
  //   }
  // }

  const maybeRepo = await util.maybeLoadRepo(res, did)
  const isNewRepo = maybeRepo === null
  let repo: Repo
  let diff: DataDiff

  // @TODO: we should do these on a temp in-memory blockstore before merging down to our on-disk one
  if (!isNewRepo) {
    repo = maybeRepo
    await repo.loadAndVerifyDiff
    diff = await repo.loadAndVerifyDiff(bytes)
  } else {
    const blockstore = util.getBlockstore(res)
    repo = await Repo.fromCarFile(bytes, blockstore)
    diff = await repo.verifySetOfUpdates(null, repo.cid)
  }

  await processDiff(db, util.getOwnHost(req), repo, did, diff)

  await subscriptions.notifySubscribers(db, repo)

  await db.setRepoRoot(did, repo.cid)

  res.status(200).send()
})

const processDiff = async (
  db: Database,
  ownHost: string,
  repo: Repo,
  did: string,
  diff: DataDiff,
): Promise<void> => {
  // @TODO fix this
  // ----------------------
  // switch (evt.event) {
  //   case delta.EventType.AddedObject: {
  //     if (evt.collection === 'posts') {
  //       const post = await repo.get(evt.cid, schema.microblog.post)
  //       await db.createPost(post, evt.cid)
  //     } else if (evt.collection === 'interactions') {
  //       const like = await repo.get(evt.cid, schema.microblog.like)
  //       await db.createLike(like, evt.cid)
  //       await subscriptions.notifyOneOff(db, ownHost, like.post_author, repo)
  //     }
  //     return
  //   }
  //   case delta.EventType.UpdatedObject: {
  //     if (evt.collection === 'posts') {
  //       const post = await repo.get(evt.cid, schema.microblog.post)
  //       await db.updatePost(post, evt.cid)
  //     } else if (evt.collection === 'interactions') {
  //       throw new ServerError(
  //         500,
  //         "We don't support in place interaction edits yet",
  //       )
  //     }
  //     return
  //   }
  //   case delta.EventType.DeletedObject: {
  //     if (evt.collection === 'posts') {
  //       await db.deletePost(evt.tid.toString(), did, evt.namespace)
  //     } else if (evt.collection === 'interactions') {
  //       const like = await db.getLike(evt.tid.toString(), did, evt.namespace)
  //       if (like) {
  //         await db.deleteLike(evt.tid.toString(), did, evt.namespace)
  //         await subscriptions.notifyOneOff(db, ownHost, like.post_author, repo)
  //       }
  //     }
  //     return
  //   }
  //   case delta.EventType.AddedRelationship: {
  //     await db.createFollow(did, evt.did)
  //     const follow = await repo.get(evt.cid, schema.repo.follow)
  //     const [name, host] = follow.username.split('@')
  //     if (host && host !== ownHost) {
  //       await db.registerDid(name, follow.did, host)
  //       await service.subscribe(
  //         `http://${host}`,
  //         follow.did,
  //         `http://${ownHost}`,
  //       )
  //       await subscriptions.notifyOneOff(db, ownHost, evt.did, repo)
  //     }
  //     return
  //   }
  //   case delta.EventType.DeletedRelationship: {
  //     await db.deleteFollow(did, evt.did)
  //     await subscriptions.notifyOneOff(db, ownHost, evt.did, repo)
  //     return
  //   }
  //   case delta.EventType.UpdatedRelationship: {
  //     throw new ServerError(
  //       500,
  //       "We don't support in place relationship edits yet",
  //     )
  //   }
  //   case delta.EventType.DeletedNamespace: {
  //     throw new ServerError(
  //       500,
  //       "We don't support full deletion of namespaces yet",
  //     )
  //   }
  //   default:
  //     throw new ServerError(500, 'Unsupported operation')
  // }
}

export default router

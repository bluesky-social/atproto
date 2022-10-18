import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { def as common } from '@atproto/common'
import * as locals from '../../../locals'
import { DataDiff, Repo } from '@atproto/repo'
import * as repoDiff from '../../../repo-diff'

export default function (server: Server) {
  server.com.atproto.syncGetRoot(async (params, _in, _req, res) => {
    const { did } = params
    const db = locals.db(res)
    const root = await db.getRepoRoot(did)
    if (root === null) {
      throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    }
    return {
      encoding: 'application/json',
      body: { root: root.toString() },
    }
  })

  server.com.atproto.syncGetRepo(async (params, _in, _req, res) => {
    const { did, from = null } = params
    const fromCid = from ? common.strToCid.parse(from) : null
    const repo = await locals.loadRepo(res, did)
    if (repo === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const diff = await repo.getDiffCar(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.syncUpdateRepo(async (params, input, _req, res) => {
    // we don't need auth here because the auth is on the data structure 😎
    const { did } = params
    const bytes = input.body
    const db = locals.db(res)

    // @TODO add something back here. new route for repos not on server?

    // check to see if we have their username in DB, for indexed queries
    // const haveUsername = await db.isDidRegistered(did)
    // if (!haveUsername) {
    //   const username = await service.getUsernameFromDidNetwork(did)
    //   if (username) {
    //     const [name, host] = username.split('@')
    //     await db.registerDid(name, did, host)
    //   }
    // }

    const maybeRepo = await locals.loadRepo(res, did)
    const isNewRepo = maybeRepo === null
    let repo: Repo
    let diff: DataDiff

    // @TODO: we should do these on a temp in-memory blockstore before merging down to our on-disk one
    if (!isNewRepo) {
      repo = maybeRepo
      await repo.loadAndVerifyDiff
      diff = await repo.loadAndVerifyDiff(bytes)
    } else {
      const blockstore = locals.blockstore(res)
      repo = await Repo.fromCarFile(bytes, blockstore)
      diff = await repo.verifySetOfUpdates(null, repo.cid)
    }

    await repoDiff.processDiff(db, repo, diff)

    // await subscriptions.notifySubscribers(db, repo)

    await db.updateRepoRoot(did, repo.cid)
  })
}

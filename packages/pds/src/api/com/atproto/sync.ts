import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../lexicon'
import SqlRepoStorage from '../../../sql-repo-storage'
import AppContext from '../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getHead(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const root = await storage.getHead()
    if (root === null) {
      throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    }
    return {
      encoding: 'application/json',
      body: { root: root.toString() },
    }
  })

  server.com.atproto.sync.getCommitPath(async ({ params }) => {
    throw new Error('Method termporarily disabled')
    // const { did } = params
    // const storage = new SqlRepoStorage(ctx.db, did)
    // const earliest = params.earliest ? CID.parse(params.earliest) : null
    // const latest = params.latest
    //   ? CID.parse(params.latest)
    //   : await storage.getHead()
    // if (latest === null) {
    //   throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    // }
    // const commitPath = await storage.getCommitPath(latest, earliest)
    // if (commitPath === null) {
    //   throw new InvalidRequestError(
    //     `Could not find a valid commit path from ${latest.toString()} to ${earliest?.toString()}`,
    //   )
    // }
    // const commits = commitPath.map((c) => c.toString())
    // return {
    //   encoding: 'application/json',
    //   body: { commits },
    // }
  })

  server.com.atproto.sync.getRepo(async ({ params }) => {
    throw new Error('Method termporarily disabled')
    // const { did, from = null } = params
    // const storage = new SqlRepoStorage(ctx.db, did)
    // const head = await storage.getHead()
    // if (head === null) {
    //   throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    // }
    // const fromCid = from ? CID.parse(from) : null
    // const diff = await repo.getDiff(storage, head, fromCid)
    // return {
    //   encoding: 'application/vnd.ipld.car',
    //   body: Buffer.from(diff),
    // }
  })

  server.com.atproto.sync.getCheckout(async ({ params }) => {
    throw new Error('Method termporarily disabled')
    // const { did } = params
    // const storage = new SqlRepoStorage(ctx.db, did)
    // const commit = params.commit
    //   ? CID.parse(params.commit)
    //   : await storage.getHead()
    // if (!commit) {
    //   throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    // }
    // const checkout = await repo.getCheckout(storage, commit)
    // return {
    //   encoding: 'application/vnd.ipld.car',
    //   body: Buffer.from(checkout),
    // }
  })

  server.com.atproto.sync.getRecord(async ({ params }) => {
    throw new Error('Method termporarily disabled')
    // const { did, collection, rkey } = params
    // const storage = new SqlRepoStorage(ctx.db, did)
    // const commit = params.commit
    //   ? CID.parse(params.commit)
    //   : await storage.getHead()
    // if (!commit) {
    //   throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    // }
    // const proof = await repo.getRecords(storage, commit, [{ collection, rkey }])
    // return {
    //   encoding: 'application/vnd.ipld.car',
    //   body: Buffer.from(proof),
    // }
  })
}

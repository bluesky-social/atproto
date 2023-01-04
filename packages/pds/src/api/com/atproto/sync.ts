import { CID } from 'multiformats/cid'
import { Repo } from '@atproto/repo'
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
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const earliest = params.earliest ? CID.parse(params.earliest) : null
    const latest = params.latest
      ? CID.parse(params.latest)
      : await storage.getHead()
    if (latest === null) {
      throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    }
    const commitPath = await storage.getCommitPath(latest, earliest)
    if (commitPath === null) {
      throw new InvalidRequestError(
        `Could not find a valid commit path from ${latest.toString()} to ${earliest?.toString()}`,
      )
    }
    const commits = commitPath.map((c) => c.toString())
    return {
      encoding: 'application/json',
      body: { commits },
    }
  })

  server.com.atproto.sync.getRepo(async ({ params }) => {
    const { did, from = null } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const root = await storage.getHead()
    if (root === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const repo = await Repo.load(storage, root)
    const fromCid = from ? CID.parse(from) : null
    const diff = await repo.getDiff(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.sync.getCheckout(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const commit = params.commit ? CID.parse(params.commit) : undefined
    const repo = await Repo.load(storage, commit)
    const checkout = await repo.getCheckout()
    return {
      encoding: 'application/cbor',
      body: Buffer.from(checkout),
    }
  })

  server.com.atproto.sync.updateRepo(async () => {
    throw new InvalidRequestError('Not implemented')
  })
}

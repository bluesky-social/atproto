import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { def as common } from '@atproto/common'
import { Repo } from '@atproto/repo'
import SqlBlockstore from '../../../sql-blockstore'
import AppContext from '../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRoot(async ({ params }) => {
    const { did } = params
    const root = await ctx.services.repo(ctx.db).getRepoRoot(did)
    if (root === null) {
      throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    }
    return {
      encoding: 'application/json',
      body: { root: root.toString() },
    }
  })

  server.com.atproto.sync.getRepo(async ({ params }) => {
    const { did, from = null } = params
    const repoRoot = await ctx.services.repo(ctx.db).getRepoRoot(did)
    if (repoRoot === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const blockstore = new SqlBlockstore(ctx.db, did)
    const repo = await Repo.load(blockstore, repoRoot)
    const fromCid = from ? common.strToCid.parse(from) : null
    const diff = await repo.getDiffCar(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.sync.updateRepo(async () => {
    throw new InvalidRequestError('Not implemented')
  })
}

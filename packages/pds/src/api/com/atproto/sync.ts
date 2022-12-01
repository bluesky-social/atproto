import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { def as common } from '@atproto/common'
import * as locals from '../../../locals'
import { Repo } from '@atproto/repo'
import SqlBlockstore from '../../../sql-blockstore'

export default function (server: Server) {
  server.com.atproto.sync.getRoot(async (params, _in, _req, res) => {
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

  server.com.atproto.sync.getRepo(async (params, _in, _req, res) => {
    const { did, from = null } = params
    const { db } = locals.get(res)
    const repoRoot = await db.getRepoRoot(did)
    if (repoRoot === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const blockstore = new SqlBlockstore(db, did)
    const repo = await Repo.load(blockstore, repoRoot)
    const fromCid = from ? common.strToCid.parse(from) : null
    const diff = await repo.getDiffCar(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.sync.updateRepo(async (_params, _input, _req, _res) => {
    throw new InvalidRequestError('Not implemented')
  })
}

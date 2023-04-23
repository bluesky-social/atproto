import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { byteIterableToStream } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRepo(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const earliest = params.earliest ? CID.parse(params.earliest) : null
    const latest = params.latest
      ? CID.parse(params.latest)
      : await storage.getHead()
    if (latest === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const commits = repo.getCommits(storage, latest, earliest)
    return {
      encoding: 'application/vnd.ipld.car',
      body: byteIterableToStream(commits),
    }
  })
}

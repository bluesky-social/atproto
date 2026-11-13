import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import getCheckout from './deprecated/getCheckout.js'
import getHead from './deprecated/getHead.js'
import getBlob from './getBlob.js'
import getBlocks from './getBlocks.js'
import getLatestCommit from './getLatestCommit.js'
import getRecord from './getRecord.js'
import getRepo from './getRepo.js'
import getRepoStatus from './getRepoStatus.js'
import listBlobs from './listBlobs.js'
import listRepos from './listRepos.js'
import subscribeRepos from './subscribeRepos.js'

export default function (server: Server, ctx: AppContext) {
  getBlob(server, ctx)
  getBlocks(server, ctx)
  getLatestCommit(server, ctx)
  getRepoStatus(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  subscribeRepos(server, ctx)
  listBlobs(server, ctx)
  listRepos(server, ctx)
  getCheckout(server, ctx)
  getHead(server, ctx)
}

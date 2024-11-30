import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getBlob from './getBlob'
import getBlocks from './getBlocks'
import getLatestCommit from './getLatestCommit'
import getRepoStatus from './getRepoStatus'
import getRecord from './getRecord'
import getRepo from './getRepo'
import subscribeRepos from './subscribeRepos'
import listBlobs from './listBlobs'
import listRepos from './listRepos'
import getCheckout from './deprecated/getCheckout'
import getHead from './deprecated/getHead'

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

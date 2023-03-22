import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getBlob from './getBlob'
import getBlocks from './getBlocks'
import getCheckout from './getCheckout'
import getCommitPath from './getCommitPath'
import getHead from './getHead'
import getRecord from './getRecord'
import getRepo from './getRepo'
import listBlobs from './listBlobs'
import subscribe from './subscribeAllRepos'

export default function (server: Server, ctx: AppContext) {
  getBlob(server, ctx)
  getBlocks(server, ctx)
  getCheckout(server, ctx)
  getCommitPath(server, ctx)
  getHead(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  listBlobs(server, ctx)
  subscribe(server, ctx)
}

import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getCheckout from './getCheckout'
import getCommitPath from './getCommitPath'
import getHead from './getHead'
import getRecord from './getRecord'
import getRepo from './getRepo'
import subscribeRepos from './subscribeRepos'

export default function (server: Server, ctx: AppContext) {
  getCheckout(server, ctx)
  getCommitPath(server, ctx)
  getHead(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  subscribeRepos(server, ctx)
}

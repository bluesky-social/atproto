import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getBlob from './getBlob'
import getRoot from './getRoot'
import getRecord from './getRecord'
import getRepo from './getRepo'
import subscribeRepos from './subscribeRepos'
import listRepos from './listRepos'

export default function (server: Server, ctx: AppContext) {
  getBlob(server, ctx)
  getRoot(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  subscribeRepos(server, ctx)
  listRepos(server, ctx)
}

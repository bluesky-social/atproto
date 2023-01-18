import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import resolveModerationReports from './resolveModerationReports'
import reverseModerationAction from './reverseModerationAction'
import takeModerationAction from './takeModerationAction'
import searchRepos from './searchRepos'
import getRecord from './getRecord'
import getRepo from './getRepo'

export default function (server: Server, ctx: AppContext) {
  resolveModerationReports(server, ctx)
  reverseModerationAction(server, ctx)
  takeModerationAction(server, ctx)
  searchRepos(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
}

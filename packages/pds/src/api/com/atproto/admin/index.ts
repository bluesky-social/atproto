import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import resolveModerationReports from './resolveModerationReports'
import reverseModerationAction from './reverseModerationAction'
import takeModerationAction from './takeModerationAction'
import searchRepos from './searchRepos'

export default function (server: Server, ctx: AppContext) {
  resolveModerationReports(server, ctx)
  reverseModerationAction(server, ctx)
  takeModerationAction(server, ctx)
  searchRepos(server, ctx)
}

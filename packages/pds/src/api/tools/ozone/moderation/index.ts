import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import emitEvent from './emitEvent'
import getEvent from './getEvent'
import getRecord from './getRecord'
import getRepo from './getRepo'
import queryEvents from './queryEvents'
import queryStatuses from './queryStatuses'
import searchRepos from './searchRepos'

export default function (server: Server, ctx: AppContext) {
  emitEvent(server, ctx)
  getEvent(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  queryEvents(server, ctx)
  queryStatuses(server, ctx)
  searchRepos(server, ctx)
}

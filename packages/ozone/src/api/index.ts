import { Server } from '../lexicon'
import AppContext from '../context'
import createReport from './com/atproto/moderation/createReport'
import emitModerationEvent from './com/atproto/admin/emitModerationEvent'
import searchRepos from './com/atproto/admin/searchRepos'
import adminGetRecord from './com/atproto/admin/getRecord'
import getRepo from './com/atproto/admin/getRepo'
import queryModerationStatuses from './com/atproto/admin/queryModerationStatuses'
import queryModerationEvents from './com/atproto/admin/queryModerationEvents'
import getModerationEvent from './com/atproto/admin/getModerationEvent'
import fetchLabels from './com/atproto/temp/fetchLabels'

export * as health from './health'

export * as wellKnown from './well-known'

export default function (server: Server, ctx: AppContext) {
  createReport(server, ctx)
  emitModerationEvent(server, ctx)
  searchRepos(server, ctx)
  adminGetRecord(server, ctx)
  getRepo(server, ctx)
  getModerationEvent(server, ctx)
  queryModerationEvents(server, ctx)
  queryModerationStatuses(server, ctx)
  fetchLabels(server, ctx)
  return server
}

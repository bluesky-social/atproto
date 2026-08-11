import { AppContext } from '../context'
import { Server } from '../lexicon'
import getProfile from './app/sokaa/actor/getProfile'
import searchActors from './app/sokaa/actor/searchActors'
import getAuthorFeed from './app/sokaa/feed/getAuthorFeed'
import getRecentFeed from './app/sokaa/feed/getRecentFeed'
import getTimeline from './app/sokaa/feed/getTimeline'

export { createRouter as health } from './health'

export default function (server: Server, ctx: AppContext) {
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getRecentFeed(server, ctx)
  getProfile(server, ctx)
  searchActors(server, ctx)
  return server
}

import { AppContext } from '../context'
import { Server } from '../lexicon'
import getProfile from './app/sokaa/actor/getProfile'
import getAuthorFeed from './app/sokaa/feed/getAuthorFeed'
import getTimeline from './app/sokaa/feed/getTimeline'

export { createRouter as health } from './health'

export default function (server: Server, ctx: AppContext) {
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getProfile(server, ctx)
  return server
}

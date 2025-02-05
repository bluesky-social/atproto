import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import getActorLikes from './getActorLikes'
import getAuthorFeed from './getAuthorFeed'
import getFeed from './getFeed'
import getPostThread from './getPostThread'
import getTimeline from './getTimeline'

export default function (server: Server, ctx: AppContext) {
  getActorLikes(server, ctx)
  getAuthorFeed(server, ctx)
  getFeed(server, ctx)
  getPostThread(server, ctx)
  getTimeline(server, ctx)
}

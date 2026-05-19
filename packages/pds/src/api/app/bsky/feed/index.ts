import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import getActorLikes from './getActorLikes.js'
import getAuthorFeed from './getAuthorFeed.js'
import getFeed from './getFeed.js'
import getPostThread from './getPostThread.js'
import getTimeline from './getTimeline.js'

export default function (server: Server, ctx: AppContext) {
  getActorLikes(server, ctx)
  getAuthorFeed(server, ctx)
  getFeed(server, ctx)
  getPostThread(server, ctx)
  getTimeline(server, ctx)
}

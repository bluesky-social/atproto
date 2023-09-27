import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getActorFeeds from './getActorFeeds'
import getActorLikes from './getActorLikes'
import getAuthorFeed from './getAuthorFeed'
import getFeed from './getFeed'
import getFeedGenerator from './getFeedGenerator'
import getFeedGenerators from './getFeedGenerators'
import getLikes from './getLikes'
import getListFeed from './getListFeed'
import getPosts from './getPosts'
import getPostThread from './getPostThread'
import getRepostedBy from './getRepostedBy'
import getSuggestedFeeds from './getSuggestedFeeds'
import getTimeline from './getTimeline'

export default function (server: Server, ctx: AppContext) {
  getActorFeeds(server, ctx)
  getActorLikes(server, ctx)
  getAuthorFeed(server, ctx)
  getFeed(server, ctx)
  getFeedGenerator(server, ctx)
  getFeedGenerators(server, ctx)
  getLikes(server, ctx)
  getListFeed(server, ctx)
  getPosts(server, ctx)
  getPostThread(server, ctx)
  getRepostedBy(server, ctx)
  getSuggestedFeeds(server, ctx)
  getTimeline(server, ctx)
}

import { Server } from '../lexicon'
import AppContext from '../context'
import getTimeline from './app/bsky/feed/getTimeline'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed'
import getLikes from './app/bsky/feed/getLikes'
import getPostThread from './app/bsky/feed/getPostThread'
import getProfile from './app/bsky/actor/getProfile'
import getProfiles from './app/bsky/actor/getProfiles'
import getRepostedBy from './app/bsky/feed/getRepostedBy'
import getFollowers from './app/bsky/graph/getFollowers'
import getFollows from './app/bsky/graph/getFollows'
import searchActors from './app/bsky/actor/searchActors'
import searchActorsTypeahead from './app/bsky/actor/searchActorsTypeahead'
import getSuggestions from './app/bsky/actor/getSuggestions'
import unspecced from './app/bsky/unspecced'

export * as health from './health'

export * as blobResolver from './blob-resolver'

export default function (server: Server, ctx: AppContext) {
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getLikes(server, ctx)
  getPostThread(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  searchActors(server, ctx)
  searchActorsTypeahead(server, ctx)
  getSuggestions(server, ctx)
  unspecced(server, ctx)
  return server
}

import { Server } from '../lexicon'
import AppContext from '../context'
import getTimeline from './app/bsky/feed/getTimeline'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed'
import getVotes from './app/bsky/feed/getVotes'
import getPostThread from './app/bsky/feed/getPostThread'
import getProfile from './app/bsky/actor/getProfile'
import getProfiles from './app/bsky/actor/getProfiles'
import getRepostedBy from './app/bsky/feed/getRepostedBy'
import getFollowers from './app/bsky/graph/getFollowers'
import getFollows from './app/bsky/graph/getFollows'
import getUsersSearch from './app/bsky/actor/search'
import getUsersTypeahead from './app/bsky/actor/searchTypeahead'
import getSuggestions from './app/bsky/actor/getSuggestions'

export * as health from './health'

export * as blobResolver from './blob-resolver'

export default function (server: Server, ctx: AppContext) {
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getVotes(server, ctx)
  getPostThread(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  getUsersSearch(server, ctx)
  getUsersTypeahead(server, ctx)
  getSuggestions(server, ctx)
  return server
}

import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getTimeline from './feed/getTimeline'
import getAuthorFeed from './feed/getAuthorFeed'
import getLikes from './feed/getLikes'
import getPostThread from './feed/getPostThread'
import getPosts from './feed/getPosts'
import getProfile from './actor/getProfile'
import getProfiles from './actor/getProfiles'
import getRepostedBy from './feed/getRepostedBy'
import getFollowers from './graph/getFollowers'
import getFollows from './graph/getFollows'
import getUsersSearch from './actor/searchActors'
import getUsersTypeahead from './actor/searchActorsTypeahead'
import getSuggestions from './actor/getSuggestions'
import unspecced from './unspecced'

export default function (server: Server, ctx: AppContext) {
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getLikes(server, ctx)
  getPostThread(server, ctx)
  getPosts(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  getUsersSearch(server, ctx)
  getUsersTypeahead(server, ctx)
  getSuggestions(server, ctx)
  unspecced(server, ctx)
}

import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getTimeline from './feed/getTimeline'
import getAuthorFeed from './feed/getAuthorFeed'
import getVotes from './feed/getVotes'
import getPostThread from './feed/getPostThread'
import getProfile from './actor/getProfile'
import getProfiles from './actor/getProfiles'
import getRepostedBy from './feed/getRepostedBy'
import getFollowers from './graph/getFollowers'
import getFollows from './graph/getFollows'
import getUsersSearch from './actor/search'
import getUsersTypeahead from './actor/searchTypeahead'
import getSuggestions from './actor/getSuggestions'

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
}

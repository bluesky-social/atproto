import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getTimeline from './feed/getTimeline'
import getActorFeeds from './feed/getActorFeeds'
import getSuggestedFeeds from './feed/getSuggestedFeeds'
import getAuthorFeed from './feed/getAuthorFeed'
import getFeedGenerator from './feed/getFeedGenerator'
import getFeedGenerators from './feed/getFeedGenerators'
import describeFeedGenerator from './feed/describeFeedGenerator'
import getFeed from './feed/getFeed'
import getLikes from './feed/getLikes'
import getPostThread from './feed/getPostThread'
import getPosts from './feed/getPosts'
import getActorLikes from './feed/getActorLikes'
import getProfile from './actor/getProfile'
import getProfiles from './actor/getProfiles'
import getRepostedBy from './feed/getRepostedBy'
import getBlocks from './graph/getBlocks'
import getFollowers from './graph/getFollowers'
import getFollows from './graph/getFollows'
import getList from './graph/getList'
import getListMutes from './graph/getListMutes'
import getLists from './graph/getLists'
import getMutes from './graph/getMutes'
import muteActor from './graph/muteActor'
import muteActorList from './graph/muteActorList'
import unmuteActor from './graph/unmuteActor'
import unmuteActorList from './graph/unmuteActorList'
import getUsersSearch from './actor/searchActors'
import getUsersTypeahead from './actor/searchActorsTypeahead'
import getSuggestions from './actor/getSuggestions'
import listNotifications from './notification/listNotifications'
import getUnreadCount from './notification/getUnreadCount'
import updateSeen from './notification/updateSeen'
import registerPush from './notification/registerPush'
import unspecced from './unspecced'

export default function (server: Server, ctx: AppContext) {
  getTimeline(server, ctx)
  getActorFeeds(server, ctx)
  getSuggestedFeeds(server, ctx)
  getAuthorFeed(server, ctx)
  getFeedGenerator(server, ctx)
  getFeedGenerators(server, ctx)
  describeFeedGenerator(server, ctx)
  getFeed(server, ctx)
  getLikes(server, ctx)
  getPostThread(server, ctx)
  getPosts(server, ctx)
  getActorLikes(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getBlocks(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  getList(server, ctx)
  getListMutes(server, ctx)
  getLists(server, ctx)
  getMutes(server, ctx)
  muteActor(server, ctx)
  muteActorList(server, ctx)
  unmuteActor(server, ctx)
  unmuteActorList(server, ctx)
  getUsersSearch(server, ctx)
  getUsersTypeahead(server, ctx)
  getSuggestions(server, ctx)
  listNotifications(server, ctx)
  getUnreadCount(server, ctx)
  updateSeen(server, ctx)
  registerPush(server, ctx)
  unspecced(server, ctx)
}

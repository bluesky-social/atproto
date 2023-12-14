import { Server } from '../lexicon'
import AppContext from '../context'
import describeFeedGenerator from './app/bsky/feed/describeFeedGenerator'
import getTimeline from './app/bsky/feed/getTimeline'
import getActorFeeds from './app/bsky/feed/getActorFeeds'
import getSuggestedFeeds from './app/bsky/feed/getSuggestedFeeds'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed'
import getFeed from './app/bsky/feed/getFeed'
import getFeedGenerator from './app/bsky/feed/getFeedGenerator'
import getFeedGenerators from './app/bsky/feed/getFeedGenerators'
import getFeedSkeleton from './app/bsky/feed/getFeedSkeleton'
import getLikes from './app/bsky/feed/getLikes'
import getListFeed from './app/bsky/feed/getListFeed'
import getPostThread from './app/bsky/feed/getPostThread'
import getPosts from './app/bsky/feed/getPosts'
import searchPosts from './app/bsky/feed/searchPosts'
import getActorLikes from './app/bsky/feed/getActorLikes'
import getProfile from './app/bsky/actor/getProfile'
import getProfiles from './app/bsky/actor/getProfiles'
import getRepostedBy from './app/bsky/feed/getRepostedBy'
import getBlocks from './app/bsky/graph/getBlocks'
import getListBlocks from './app/bsky/graph/getListBlocks'
import getFollowers from './app/bsky/graph/getFollowers'
import getFollows from './app/bsky/graph/getFollows'
import getList from './app/bsky/graph/getList'
import getLists from './app/bsky/graph/getLists'
import getListMutes from './app/bsky/graph/getListMutes'
import getMutes from './app/bsky/graph/getMutes'
import muteActor from './app/bsky/graph/muteActor'
import unmuteActor from './app/bsky/graph/unmuteActor'
import muteActorList from './app/bsky/graph/muteActorList'
import unmuteActorList from './app/bsky/graph/unmuteActorList'
import getSuggestedFollowsByActor from './app/bsky/graph/getSuggestedFollowsByActor'
import searchActors from './app/bsky/actor/searchActors'
import searchActorsTypeahead from './app/bsky/actor/searchActorsTypeahead'
import getSuggestions from './app/bsky/actor/getSuggestions'
import getUnreadCount from './app/bsky/notification/getUnreadCount'
import listNotifications from './app/bsky/notification/listNotifications'
import updateSeen from './app/bsky/notification/updateSeen'
import registerPush from './app/bsky/notification/registerPush'
import getPopularFeedGenerators from './app/bsky/unspecced/getPopularFeedGenerators'
import getTimelineSkeleton from './app/bsky/unspecced/getTimelineSkeleton'
import createReport from './com/atproto/moderation/createReport'
import emitModerationEvent from './com/atproto/admin/emitModerationEvent'
import searchRepos from './com/atproto/admin/searchRepos'
import adminGetRecord from './com/atproto/admin/getRecord'
import getRepo from './com/atproto/admin/getRepo'
import queryModerationStatuses from './com/atproto/admin/queryModerationStatuses'
import resolveHandle from './com/atproto/identity/resolveHandle'
import getRecord from './com/atproto/repo/getRecord'
import queryModerationEvents from './com/atproto/admin/queryModerationEvents'
import getModerationEvent from './com/atproto/admin/getModerationEvent'
import fetchLabels from './com/atproto/temp/fetchLabels'

export * as health from './health'

export * as wellKnown from './well-known'

export * as blobResolver from './blob-resolver'

export default function (server: Server, ctx: AppContext) {
  // app.bsky
  describeFeedGenerator(server, ctx)
  getTimeline(server, ctx)
  getActorFeeds(server, ctx)
  getSuggestedFeeds(server, ctx)
  getAuthorFeed(server, ctx)
  getFeed(server, ctx)
  getFeedGenerator(server, ctx)
  getFeedGenerators(server, ctx)
  getFeedSkeleton(server, ctx)
  getLikes(server, ctx)
  getListFeed(server, ctx)
  getPostThread(server, ctx)
  getPosts(server, ctx)
  searchPosts(server, ctx)
  getActorLikes(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getBlocks(server, ctx)
  getListBlocks(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  getList(server, ctx)
  getLists(server, ctx)
  getListMutes(server, ctx)
  getMutes(server, ctx)
  muteActor(server, ctx)
  unmuteActor(server, ctx)
  muteActorList(server, ctx)
  unmuteActorList(server, ctx)
  getSuggestedFollowsByActor(server, ctx)
  searchActors(server, ctx)
  searchActorsTypeahead(server, ctx)
  getSuggestions(server, ctx)
  getUnreadCount(server, ctx)
  listNotifications(server, ctx)
  updateSeen(server, ctx)
  registerPush(server, ctx)
  getPopularFeedGenerators(server, ctx)
  getTimelineSkeleton(server, ctx)
  // com.atproto
  createReport(server, ctx)
  emitModerationEvent(server, ctx)
  searchRepos(server, ctx)
  adminGetRecord(server, ctx)
  getRepo(server, ctx)
  getModerationEvent(server, ctx)
  queryModerationEvents(server, ctx)
  queryModerationStatuses(server, ctx)
  resolveHandle(server, ctx)
  getRecord(server, ctx)
  fetchLabels(server, ctx)
  return server
}

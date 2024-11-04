import { Server } from '../lexicon'
import AppContext from '../context'
import getTimeline from './app/bsky/feed/getTimeline'
import getActorFeeds from './app/bsky/feed/getActorFeeds'
import getSuggestedFeeds from './app/bsky/feed/getSuggestedFeeds'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed'
import getFeed from './app/bsky/feed/getFeed'
import getFeedGenerator from './app/bsky/feed/getFeedGenerator'
import getFeedGenerators from './app/bsky/feed/getFeedGenerators'
import getLikes from './app/bsky/feed/getLikes'
import getListFeed from './app/bsky/feed/getListFeed'
import getPostThread from './app/bsky/feed/getPostThread'
import getPosts from './app/bsky/feed/getPosts'
import searchPosts from './app/bsky/feed/searchPosts'
import getActorLikes from './app/bsky/feed/getActorLikes'
import getQuotes from './app/bsky/feed/getQuotes'
import getProfile from './app/bsky/actor/getProfile'
import getProfiles from './app/bsky/actor/getProfiles'
import getRepostedBy from './app/bsky/feed/getRepostedBy'
import getActorStarterPacks from './app/bsky/graph/getActorStarterPacks'
import getBlocks from './app/bsky/graph/getBlocks'
import getListBlocks from './app/bsky/graph/getListBlocks'
import getFollowers from './app/bsky/graph/getFollowers'
import getKnownFollowers from './app/bsky/graph/getKnownFollowers'
import getFollows from './app/bsky/graph/getFollows'
import getList from './app/bsky/graph/getList'
import getLists from './app/bsky/graph/getLists'
import getListMutes from './app/bsky/graph/getListMutes'
import getMutes from './app/bsky/graph/getMutes'
import getRelationships from './app/bsky/graph/getRelationships'
import getStarterPack from './app/bsky/graph/getStarterPack'
import getStarterPacks from './app/bsky/graph/getStarterPacks'
import muteActor from './app/bsky/graph/muteActor'
import unmuteActor from './app/bsky/graph/unmuteActor'
import muteActorList from './app/bsky/graph/muteActorList'
import unmuteActorList from './app/bsky/graph/unmuteActorList'
import muteThread from './app/bsky/graph/muteThread'
import unmuteThread from './app/bsky/graph/unmuteThread'
import getSuggestedFollowsByActor from './app/bsky/graph/getSuggestedFollowsByActor'
import getLabelerServices from './app/bsky/labeler/getServices'
import searchActors from './app/bsky/actor/searchActors'
import searchActorsTypeahead from './app/bsky/actor/searchActorsTypeahead'
import getSuggestions from './app/bsky/actor/getSuggestions'
import getUnreadCount from './app/bsky/notification/getUnreadCount'
import listNotifications from './app/bsky/notification/listNotifications'
import updateSeen from './app/bsky/notification/updateSeen'
import putPreferences from './app/bsky/notification/putPreferences'
import registerPush from './app/bsky/notification/registerPush'
import getConfig from './app/bsky/unspecced/getConfig'
import getPopularFeedGenerators from './app/bsky/unspecced/getPopularFeedGenerators'
import getTaggedSuggestions from './app/bsky/unspecced/getTaggedSuggestions'
import getSubjectStatus from './com/atproto/admin/getSubjectStatus'
import updateSubjectStatus from './com/atproto/admin/updateSubjectStatus'
import getAccountInfos from './com/atproto/admin/getAccountInfos'
import resolveHandle from './com/atproto/identity/resolveHandle'
import getRecord from './com/atproto/repo/getRecord'
import fetchLabels from './com/atproto/temp/fetchLabels'
import queryLabels from './com/atproto/label/queryLabels'

export * as health from './health'

export * as wellKnown from './well-known'

export * as blobResolver from './blob-resolver'

export default function (server: Server, ctx: AppContext) {
  // app.bsky
  getTimeline(server, ctx)
  getActorFeeds(server, ctx)
  getSuggestedFeeds(server, ctx)
  getAuthorFeed(server, ctx)
  getFeed(server, ctx)
  getFeedGenerator(server, ctx)
  getFeedGenerators(server, ctx)
  getLikes(server, ctx)
  getListFeed(server, ctx)
  getQuotes(server, ctx)
  getPostThread(server, ctx)
  getPosts(server, ctx)
  searchPosts(server, ctx)
  getActorLikes(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getActorStarterPacks(server, ctx)
  getBlocks(server, ctx)
  getListBlocks(server, ctx)
  getFollowers(server, ctx)
  getKnownFollowers(server, ctx)
  getFollows(server, ctx)
  getList(server, ctx)
  getLists(server, ctx)
  getListMutes(server, ctx)
  getMutes(server, ctx)
  getRelationships(server, ctx)
  getStarterPack(server, ctx)
  getStarterPacks(server, ctx)
  muteActor(server, ctx)
  unmuteActor(server, ctx)
  muteActorList(server, ctx)
  unmuteActorList(server, ctx)
  muteThread(server, ctx)
  unmuteThread(server, ctx)
  getSuggestedFollowsByActor(server, ctx)
  getLabelerServices(server, ctx)
  searchActors(server, ctx)
  searchActorsTypeahead(server, ctx)
  getSuggestions(server, ctx)
  getUnreadCount(server, ctx)
  listNotifications(server, ctx)
  updateSeen(server, ctx)
  putPreferences(server, ctx)
  registerPush(server, ctx)
  getConfig(server, ctx)
  getPopularFeedGenerators(server, ctx)
  getTaggedSuggestions(server, ctx)
  // com.atproto
  getSubjectStatus(server, ctx)
  updateSubjectStatus(server, ctx)
  getAccountInfos(server, ctx)
  resolveHandle(server, ctx)
  getRecord(server, ctx)
  fetchLabels(server, ctx)
  queryLabels(server, ctx)
  return server
}

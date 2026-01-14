import { AppContext } from '../context'
import { Server } from '../lexicon'
import getProfile from './app/bsky/actor/getProfile'
import getProfiles from './app/bsky/actor/getProfiles'
import getSuggestions from './app/bsky/actor/getSuggestions'
import searchActors from './app/bsky/actor/searchActors'
import searchActorsTypeahead from './app/bsky/actor/searchActorsTypeahead'
import aaBegin from './app/bsky/ageassurance/begin'
import aaGetConfig from './app/bsky/ageassurance/getConfig'
import aaGetState from './app/bsky/ageassurance/getState'
import createBookmark from './app/bsky/bookmark/createBookmark'
import deleteBookmark from './app/bsky/bookmark/deleteBookmark'
import getBookmarks from './app/bsky/bookmark/getBookmarks'
import dismissMatch from './app/bsky/contact/dismissMatch'
import getMatches from './app/bsky/contact/getMatches'
import getSyncStatus from './app/bsky/contact/getSyncStatus'
import importContacts from './app/bsky/contact/importContacts'
import removeData from './app/bsky/contact/removeData'
import sendNotification from './app/bsky/contact/sendNotification'
import startPhoneVerification from './app/bsky/contact/startPhoneVerification'
import verifyPhone from './app/bsky/contact/verifyPhone'
import createDraft from './app/bsky/draft/createDraft'
import deleteDraft from './app/bsky/draft/deleteDraft'
import getDrafts from './app/bsky/draft/getDrafts'
import updateDraft from './app/bsky/draft/updateDraft'
import getActorFeeds from './app/bsky/feed/getActorFeeds'
import getActorLikes from './app/bsky/feed/getActorLikes'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed'
import getFeed from './app/bsky/feed/getFeed'
import getFeedGenerator from './app/bsky/feed/getFeedGenerator'
import getFeedGenerators from './app/bsky/feed/getFeedGenerators'
import getLikes from './app/bsky/feed/getLikes'
import getListFeed from './app/bsky/feed/getListFeed'
import getPostThread from './app/bsky/feed/getPostThread'
import getPosts from './app/bsky/feed/getPosts'
import getQuotes from './app/bsky/feed/getQuotes'
import getRepostedBy from './app/bsky/feed/getRepostedBy'
import getSuggestedFeeds from './app/bsky/feed/getSuggestedFeeds'
import getTimeline from './app/bsky/feed/getTimeline'
import searchPosts from './app/bsky/feed/searchPosts'
import getActorStarterPacks from './app/bsky/graph/getActorStarterPacks'
import getBlocks from './app/bsky/graph/getBlocks'
import getFollowers from './app/bsky/graph/getFollowers'
import getFollows from './app/bsky/graph/getFollows'
import getKnownFollowers from './app/bsky/graph/getKnownFollowers'
import getList from './app/bsky/graph/getList'
import getListBlocks from './app/bsky/graph/getListBlocks'
import getListMutes from './app/bsky/graph/getListMutes'
import getLists from './app/bsky/graph/getLists'
import getListsWithMembership from './app/bsky/graph/getListsWithMembership'
import getMutes from './app/bsky/graph/getMutes'
import getRelationships from './app/bsky/graph/getRelationships'
import getStarterPack from './app/bsky/graph/getStarterPack'
import getStarterPacks from './app/bsky/graph/getStarterPacks'
import getStarterPacksWithMembership from './app/bsky/graph/getStarterPacksWithMembership'
import getSuggestedFollowsByActor from './app/bsky/graph/getSuggestedFollowsByActor'
import muteActor from './app/bsky/graph/muteActor'
import muteActorList from './app/bsky/graph/muteActorList'
import muteThread from './app/bsky/graph/muteThread'
import searchStarterPacks from './app/bsky/graph/searchStarterPacks'
import unmuteActor from './app/bsky/graph/unmuteActor'
import unmuteActorList from './app/bsky/graph/unmuteActorList'
import unmuteThread from './app/bsky/graph/unmuteThread'
import getLabelerServices from './app/bsky/labeler/getServices'
import getPreferences from './app/bsky/notification/getPreferences'
import getUnreadCount from './app/bsky/notification/getUnreadCount'
import listActivitySubscriptions from './app/bsky/notification/listActivitySubscriptions'
import listNotifications from './app/bsky/notification/listNotifications'
import putActivitySubscription from './app/bsky/notification/putActivitySubscription'
import putPreferences from './app/bsky/notification/putPreferences'
import putPreferencesV2 from './app/bsky/notification/putPreferencesV2'
import registerPush from './app/bsky/notification/registerPush'
import unregisterPush from './app/bsky/notification/unregisterPush'
import updateSeen from './app/bsky/notification/updateSeen'
import getAgeAssuranceState from './app/bsky/unspecced/getAgeAssuranceState'
import getConfig from './app/bsky/unspecced/getConfig'
import getOnboardingSuggestedStarterPacks from './app/bsky/unspecced/getOnboardingSuggestedStarterPacks'
import getPopularFeedGenerators from './app/bsky/unspecced/getPopularFeedGenerators'
import getPostThreadOtherV2 from './app/bsky/unspecced/getPostThreadOtherV2'
import getPostThreadV2 from './app/bsky/unspecced/getPostThreadV2'
import getUnspeccedSuggestedFeeds from './app/bsky/unspecced/getSuggestedFeeds'
import getSuggestedStarterPacks from './app/bsky/unspecced/getSuggestedStarterPacks'
import getSuggestedUsers from './app/bsky/unspecced/getSuggestedUsers'
import getTaggedSuggestions from './app/bsky/unspecced/getTaggedSuggestions'
import getTrendingTopics from './app/bsky/unspecced/getTrendingTopics'
import getTrends from './app/bsky/unspecced/getTrends'
import initAgeAssurance from './app/bsky/unspecced/initAgeAssurance'
import getAccountInfos from './com/atproto/admin/getAccountInfos'
import getSubjectStatus from './com/atproto/admin/getSubjectStatus'
import updateSubjectStatus from './com/atproto/admin/updateSubjectStatus'
import resolveHandle from './com/atproto/identity/resolveHandle'
import queryLabels from './com/atproto/label/queryLabels'
import getRecord from './com/atproto/repo/getRecord'
import fetchLabels from './com/atproto/temp/fetchLabels'

export * as health from './health'

export * as wellKnown from './well-known'

export * as blobResolver from './blob-resolver'

export * as external from './external'

export * as sitemap from './sitemap'

export default function (server: Server, ctx: AppContext) {
  // app.bsky
  getTimeline(server, ctx)
  createBookmark(server, ctx)
  deleteBookmark(server, ctx)
  getBookmarks(server, ctx)
  createDraft(server, ctx)
  deleteDraft(server, ctx)
  getDrafts(server, ctx)
  updateDraft(server, ctx)
  dismissMatch(server, ctx)
  getMatches(server, ctx)
  getSyncStatus(server, ctx)
  importContacts(server, ctx)
  removeData(server, ctx)
  sendNotification(server, ctx)
  startPhoneVerification(server, ctx)
  verifyPhone(server, ctx)
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
  getPostThreadOtherV2(server, ctx)
  getPostThreadV2(server, ctx)
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
  getListsWithMembership(server, ctx)
  getListMutes(server, ctx)
  getMutes(server, ctx)
  getRelationships(server, ctx)
  getStarterPack(server, ctx)
  getStarterPacks(server, ctx)
  getStarterPacksWithMembership(server, ctx)
  searchStarterPacks(server, ctx)
  muteActor(server, ctx)
  unmuteActor(server, ctx)
  muteActorList(server, ctx)
  unmuteActorList(server, ctx)
  muteThread(server, ctx)
  unmuteThread(server, ctx)
  getSuggestedFollowsByActor(server, ctx)
  getTrendingTopics(server, ctx)
  getTrends(server, ctx)
  getOnboardingSuggestedStarterPacks(server, ctx)
  getSuggestedStarterPacks(server, ctx)
  getSuggestedUsers(server, ctx)
  getUnspeccedSuggestedFeeds(server, ctx)
  getLabelerServices(server, ctx)
  searchActors(server, ctx)
  searchActorsTypeahead(server, ctx)
  getSuggestions(server, ctx)
  getPreferences(server, ctx)
  getUnreadCount(server, ctx)
  listActivitySubscriptions(server, ctx)
  listNotifications(server, ctx)
  putActivitySubscription(server, ctx)
  updateSeen(server, ctx)
  putPreferences(server, ctx)
  putPreferencesV2(server, ctx)
  registerPush(server, ctx)
  unregisterPush(server, ctx)
  getConfig(server, ctx)
  getPopularFeedGenerators(server, ctx)
  getTaggedSuggestions(server, ctx)
  getAgeAssuranceState(server, ctx)
  initAgeAssurance(server, ctx)
  aaGetConfig(server, ctx)
  aaGetState(server, ctx)
  aaBegin(server, ctx)
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

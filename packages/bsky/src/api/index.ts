import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../context.js'
import getProfile from './app/bsky/actor/getProfile.js'
import getProfiles from './app/bsky/actor/getProfiles.js'
import getSuggestions from './app/bsky/actor/getSuggestions.js'
import searchActors from './app/bsky/actor/searchActors.js'
import searchActorsTypeahead from './app/bsky/actor/searchActorsTypeahead.js'
import aaBegin from './app/bsky/ageassurance/begin.js'
import aaGetConfig from './app/bsky/ageassurance/getConfig.js'
import aaGetState from './app/bsky/ageassurance/getState.js'
import createBookmark from './app/bsky/bookmark/createBookmark.js'
import deleteBookmark from './app/bsky/bookmark/deleteBookmark.js'
import getBookmarks from './app/bsky/bookmark/getBookmarks.js'
import dismissMatch from './app/bsky/contact/dismissMatch.js'
import getMatches from './app/bsky/contact/getMatches.js'
import getSyncStatus from './app/bsky/contact/getSyncStatus.js'
import importContacts from './app/bsky/contact/importContacts.js'
import removeData from './app/bsky/contact/removeData.js'
import sendNotification from './app/bsky/contact/sendNotification.js'
import startPhoneVerification from './app/bsky/contact/startPhoneVerification.js'
import verifyPhone from './app/bsky/contact/verifyPhone.js'
import createDraft from './app/bsky/draft/createDraft.js'
import deleteDraft from './app/bsky/draft/deleteDraft.js'
import getDrafts from './app/bsky/draft/getDrafts.js'
import updateDraft from './app/bsky/draft/updateDraft.js'
import getEmbedExternalView from './app/bsky/embed/getEmbedExternalView.js'
import getActorFeeds from './app/bsky/feed/getActorFeeds.js'
import getActorLikes from './app/bsky/feed/getActorLikes.js'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed.js'
import getFeed from './app/bsky/feed/getFeed.js'
import getFeedGenerator from './app/bsky/feed/getFeedGenerator.js'
import getFeedGenerators from './app/bsky/feed/getFeedGenerators.js'
import getLikes from './app/bsky/feed/getLikes.js'
import getListFeed from './app/bsky/feed/getListFeed.js'
import getPostThread from './app/bsky/feed/getPostThread.js'
import getPosts from './app/bsky/feed/getPosts.js'
import getQuotes from './app/bsky/feed/getQuotes.js'
import getRepostedBy from './app/bsky/feed/getRepostedBy.js'
import getSuggestedFeeds from './app/bsky/feed/getSuggestedFeeds.js'
import getTimeline from './app/bsky/feed/getTimeline.js'
import searchPosts from './app/bsky/feed/searchPosts.js'
import searchPostsV2 from './app/bsky/feed/searchPostsV2.js'
import getActorStarterPacks from './app/bsky/graph/getActorStarterPacks.js'
import getBlocks from './app/bsky/graph/getBlocks.js'
import getFollowers from './app/bsky/graph/getFollowers.js'
import getFollows from './app/bsky/graph/getFollows.js'
import getKnownFollowers from './app/bsky/graph/getKnownFollowers.js'
import getList from './app/bsky/graph/getList.js'
import getListBlocks from './app/bsky/graph/getListBlocks.js'
import getListMutes from './app/bsky/graph/getListMutes.js'
import getLists from './app/bsky/graph/getLists.js'
import getListsWithMembership from './app/bsky/graph/getListsWithMembership.js'
import getMutes from './app/bsky/graph/getMutes.js'
import getRelationships from './app/bsky/graph/getRelationships.js'
import getStarterPack from './app/bsky/graph/getStarterPack.js'
import getStarterPacks from './app/bsky/graph/getStarterPacks.js'
import getStarterPacksWithMembership from './app/bsky/graph/getStarterPacksWithMembership.js'
import getSuggestedFollowsByActor from './app/bsky/graph/getSuggestedFollowsByActor.js'
import muteActor from './app/bsky/graph/muteActor.js'
import muteActorList from './app/bsky/graph/muteActorList.js'
import muteThread from './app/bsky/graph/muteThread.js'
import searchStarterPacks from './app/bsky/graph/searchStarterPacks.js'
import unmuteActor from './app/bsky/graph/unmuteActor.js'
import unmuteActorList from './app/bsky/graph/unmuteActorList.js'
import unmuteThread from './app/bsky/graph/unmuteThread.js'
import getLabelerServices from './app/bsky/labeler/getServices.js'
import getPreferences from './app/bsky/notification/getPreferences.js'
import getUnreadCount from './app/bsky/notification/getUnreadCount.js'
import listActivitySubscriptions from './app/bsky/notification/listActivitySubscriptions.js'
import listNotifications from './app/bsky/notification/listNotifications.js'
import putActivitySubscription from './app/bsky/notification/putActivitySubscription.js'
import putPreferences from './app/bsky/notification/putPreferences.js'
import putPreferencesV2 from './app/bsky/notification/putPreferencesV2.js'
import registerPush from './app/bsky/notification/registerPush.js'
import unregisterPush from './app/bsky/notification/unregisterPush.js'
import updateSeen from './app/bsky/notification/updateSeen.js'
import getAgeAssuranceState from './app/bsky/unspecced/getAgeAssuranceState.js'
import getConfig from './app/bsky/unspecced/getConfig.js'
import getOnboardingSuggestedStarterPacks from './app/bsky/unspecced/getOnboardingSuggestedStarterPacks.js'
import getPopularFeedGenerators from './app/bsky/unspecced/getPopularFeedGenerators.js'
import getPostThreadOtherV2 from './app/bsky/unspecced/getPostThreadOtherV2.js'
import getPostThreadV2 from './app/bsky/unspecced/getPostThreadV2.js'
import getUnspeccedSuggestedFeeds from './app/bsky/unspecced/getSuggestedFeeds.js'
import getSuggestedOnboardingUsers from './app/bsky/unspecced/getSuggestedOnboardingUsers.js'
import getSuggestedStarterPacks from './app/bsky/unspecced/getSuggestedStarterPacks.js'
import getSuggestedUsers from './app/bsky/unspecced/getSuggestedUsers.js'
import getSuggestedUsersForDiscover from './app/bsky/unspecced/getSuggestedUsersForDiscover.js'
import getSuggestedUsersForExplore from './app/bsky/unspecced/getSuggestedUsersForExplore.js'
import getSuggestedUsersForSeeMore from './app/bsky/unspecced/getSuggestedUsersForSeeMore.js'
import getTaggedSuggestions from './app/bsky/unspecced/getTaggedSuggestions.js'
import getTrendingTopics from './app/bsky/unspecced/getTrendingTopics.js'
import getTrends from './app/bsky/unspecced/getTrends.js'
import initAgeAssurance from './app/bsky/unspecced/initAgeAssurance.js'
import getAccountInfos from './com/atproto/admin/getAccountInfos.js'
import getSubjectStatus from './com/atproto/admin/getSubjectStatus.js'
import updateSubjectStatus from './com/atproto/admin/updateSubjectStatus.js'
import resolveHandle from './com/atproto/identity/resolveHandle.js'
import queryLabels from './com/atproto/label/queryLabels.js'
import getRecord from './com/atproto/repo/getRecord.js'
import fetchLabels from './com/atproto/temp/fetchLabels.js'
import internalGetProfiles from './internal/bsky/actor/getProfiles.js'

export * as health from './health.js'

export * as wellKnown from './well-known.js'

export * as blobResolver from './blob-resolver.js'

export * as external from './external.js'

export * as sitemap from './sitemap.js'

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
  getEmbedExternalView(server, ctx)
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
  searchPostsV2(server, ctx)
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
  getSuggestedOnboardingUsers(server, ctx)
  getSuggestedStarterPacks(server, ctx)
  getSuggestedUsers(server, ctx)
  getSuggestedUsersForDiscover(server, ctx)
  getSuggestedUsersForExplore(server, ctx)
  getSuggestedUsersForSeeMore(server, ctx)
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
  // internal.bsky
  internalGetProfiles(server, ctx)
}

import { describe, expect, it, vi } from 'vitest'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { Gate } from '../../../feature-gates/gates.js'
import type { Hydrator } from '../../../hydration/hydrator.js'
import { app, internal } from '../../../lexicons/index.js'
import getInternalProfiles from '../../internal/bsky/actor/getProfiles.js'
import getProfile from './actor/getProfile.js'
import getProfiles from './actor/getProfiles.js'
import getSuggestions from './actor/getSuggestions.js'
import searchActors from './actor/searchActors.js'
import searchActorsTypeahead from './actor/searchActorsTypeahead.js'
import getBookmarks from './bookmark/getBookmarks.js'
import getMatches from './contact/getMatches.js'
import importContacts from './contact/importContacts.js'
import getEmbedExternalView from './embed/getEmbedExternalView.js'
import getActorFeeds from './feed/getActorFeeds.js'
import getActorLikes from './feed/getActorLikes.js'
import getAuthorFeed from './feed/getAuthorFeed.js'
import getFeed from './feed/getFeed.js'
import getFeedGenerator from './feed/getFeedGenerator.js'
import getFeedGenerators from './feed/getFeedGenerators.js'
import getLikes from './feed/getLikes.js'
import getListFeed from './feed/getListFeed.js'
import getPostThread from './feed/getPostThread.js'
import getPosts from './feed/getPosts.js'
import getQuotes from './feed/getQuotes.js'
import getRepostedBy from './feed/getRepostedBy.js'
import getFeedSuggestedFeeds from './feed/getSuggestedFeeds.js'
import getTimeline from './feed/getTimeline.js'
import searchPosts from './feed/searchPosts.js'
import searchPostsV2 from './feed/searchPostsV2.js'
import getActorStarterPacks from './graph/getActorStarterPacks.js'
import getBlocks from './graph/getBlocks.js'
import getFollowers from './graph/getFollowers.js'
import getFollows from './graph/getFollows.js'
import getKnownFollowers from './graph/getKnownFollowers.js'
import getList from './graph/getList.js'
import getListBlocks from './graph/getListBlocks.js'
import getListMutes from './graph/getListMutes.js'
import getLists from './graph/getLists.js'
import getListsWithMembership from './graph/getListsWithMembership.js'
import getMutes from './graph/getMutes.js'
import getStarterPack from './graph/getStarterPack.js'
import getStarterPacks from './graph/getStarterPacks.js'
import getStarterPacksWithMembership from './graph/getStarterPacksWithMembership.js'
import getSuggestedFollowsByActor from './graph/getSuggestedFollowsByActor.js'
import searchStarterPacks from './graph/searchStarterPacks.js'
import searchStarterPacksV2 from './graph/searchStarterPacksV2.js'
import getServices from './labeler/getServices.js'
import getGroupedNotifications from './notification/getGroupedNotifications.js'
import listActivitySubscriptions from './notification/listActivitySubscriptions.js'
import listNotifications from './notification/listNotifications.js'
import getAtmosphereExploreTab from './unspecced/getAtmosphereExploreTab.js'
import getOnboardingSuggestedStarterPacks from './unspecced/getOnboardingSuggestedStarterPacks.js'
import getPopularFeedGenerators from './unspecced/getPopularFeedGenerators.js'
import getPostThreadOtherV2 from './unspecced/getPostThreadOtherV2.js'
import getPostThreadV2 from './unspecced/getPostThreadV2.js'
import getUnspeccedSuggestedFeeds from './unspecced/getSuggestedFeeds.js'
import getSuggestedOnboardingUsers from './unspecced/getSuggestedOnboardingUsers.js'
import getSuggestedStarterPacks from './unspecced/getSuggestedStarterPacks.js'
import getSuggestedUsers from './unspecced/getSuggestedUsers.js'
import getSuggestedUsersForDiscover from './unspecced/getSuggestedUsersForDiscover.js'
import getSuggestedUsersForExplore from './unspecced/getSuggestedUsersForExplore.js'
import getSuggestedUsersForSeeMore from './unspecced/getSuggestedUsersForSeeMore.js'
import getTrendingTopics from './unspecced/getTrendingTopics.js'
import getTrends from './unspecced/getTrends.js'

const routes: {
  schema: { $lxm: string }
  register: (server: Server, ctx: AppContext) => void
  atmosphere?: boolean
}[] = [
  { schema: app.bsky.actor.getProfile, register: getProfile },
  { schema: app.bsky.actor.getProfiles, register: getProfiles },
  { schema: app.bsky.actor.getSuggestions, register: getSuggestions },
  { schema: app.bsky.actor.searchActors, register: searchActors },
  {
    schema: app.bsky.actor.searchActorsTypeahead,
    register: searchActorsTypeahead,
  },
  { schema: app.bsky.bookmark.getBookmarks, register: getBookmarks },
  { schema: app.bsky.contact.getMatches, register: getMatches },
  { schema: app.bsky.contact.importContacts, register: importContacts },
  {
    schema: app.bsky.embed.getEmbedExternalView,
    register: getEmbedExternalView,
  },
  { schema: app.bsky.feed.getActorFeeds, register: getActorFeeds },
  { schema: app.bsky.feed.getActorLikes, register: getActorLikes },
  { schema: app.bsky.feed.getAuthorFeed, register: getAuthorFeed },
  { schema: app.bsky.feed.getFeed, register: getFeed },
  { schema: app.bsky.feed.getFeedGenerator, register: getFeedGenerator },
  { schema: app.bsky.feed.getFeedGenerators, register: getFeedGenerators },
  { schema: app.bsky.feed.getLikes, register: getLikes },
  { schema: app.bsky.feed.getListFeed, register: getListFeed },
  { schema: app.bsky.feed.getPostThread, register: getPostThread },
  { schema: app.bsky.feed.getPosts, register: getPosts },
  { schema: app.bsky.feed.getQuotes, register: getQuotes },
  { schema: app.bsky.feed.getRepostedBy, register: getRepostedBy },
  { schema: app.bsky.feed.getSuggestedFeeds, register: getFeedSuggestedFeeds },
  { schema: app.bsky.feed.getTimeline, register: getTimeline },
  { schema: app.bsky.feed.searchPosts, register: searchPosts },
  { schema: app.bsky.feed.searchPostsV2, register: searchPostsV2 },
  {
    schema: app.bsky.graph.getActorStarterPacks,
    register: getActorStarterPacks,
  },
  { schema: app.bsky.graph.getBlocks, register: getBlocks },
  { schema: app.bsky.graph.getFollowers, register: getFollowers },
  { schema: app.bsky.graph.getFollows, register: getFollows },
  { schema: app.bsky.graph.getKnownFollowers, register: getKnownFollowers },
  { schema: app.bsky.graph.getList, register: getList },
  { schema: app.bsky.graph.getListBlocks, register: getListBlocks },
  { schema: app.bsky.graph.getListMutes, register: getListMutes },
  { schema: app.bsky.graph.getLists, register: getLists },
  {
    schema: app.bsky.graph.getListsWithMembership,
    register: getListsWithMembership,
  },
  { schema: app.bsky.graph.getMutes, register: getMutes },
  { schema: app.bsky.graph.getStarterPack, register: getStarterPack },
  { schema: app.bsky.graph.getStarterPacks, register: getStarterPacks },
  {
    schema: app.bsky.graph.getStarterPacksWithMembership,
    register: getStarterPacksWithMembership,
  },
  {
    schema: app.bsky.graph.getSuggestedFollowsByActor,
    register: getSuggestedFollowsByActor,
  },
  { schema: app.bsky.graph.searchStarterPacks, register: searchStarterPacks },
  {
    schema: app.bsky.graph.searchStarterPacksV2,
    register: searchStarterPacksV2,
  },
  { schema: app.bsky.labeler.getServices, register: getServices },
  {
    schema: app.bsky.notification.getGroupedNotifications,
    register: getGroupedNotifications,
  },
  {
    schema: app.bsky.notification.listActivitySubscriptions,
    register: listActivitySubscriptions,
  },
  {
    schema: app.bsky.notification.listNotifications,
    register: listNotifications,
  },
  {
    schema: app.bsky.unspecced.getAtmosphereExploreTab,
    register: getAtmosphereExploreTab,
    atmosphere: true,
  },
  {
    schema: app.bsky.unspecced.getOnboardingSuggestedStarterPacks,
    register: getOnboardingSuggestedStarterPacks,
  },
  {
    schema: app.bsky.unspecced.getPopularFeedGenerators,
    register: getPopularFeedGenerators,
  },
  {
    schema: app.bsky.unspecced.getPostThreadOtherV2,
    register: getPostThreadOtherV2,
  },
  { schema: app.bsky.unspecced.getPostThreadV2, register: getPostThreadV2 },
  {
    schema: app.bsky.unspecced.getSuggestedFeeds,
    register: getUnspeccedSuggestedFeeds,
  },
  {
    schema: app.bsky.unspecced.getSuggestedOnboardingUsers,
    register: getSuggestedOnboardingUsers,
  },
  {
    schema: app.bsky.unspecced.getSuggestedStarterPacks,
    register: getSuggestedStarterPacks,
  },
  { schema: app.bsky.unspecced.getSuggestedUsers, register: getSuggestedUsers },
  {
    schema: app.bsky.unspecced.getSuggestedUsersForDiscover,
    register: getSuggestedUsersForDiscover,
  },
  {
    schema: app.bsky.unspecced.getSuggestedUsersForExplore,
    register: getSuggestedUsersForExplore,
  },
  {
    schema: app.bsky.unspecced.getSuggestedUsersForSeeMore,
    register: getSuggestedUsersForSeeMore,
  },
  { schema: app.bsky.unspecced.getTrendingTopics, register: getTrendingTopics },
  { schema: app.bsky.unspecced.getTrends, register: getTrends },
  { schema: internal.bsky.actor.getProfiles, register: getInternalProfiles },
]

type HandlerInput = {
  params: object
  auth: { credentials: { iss: string } }
  req: { header: () => undefined }
}

describe('hydration endpoint attribution', () => {
  it.each(routes)(
    'passes $schema.$lxm to hydration',
    async ({ schema, register, atmosphere }) => {
      const sentinel = new Error('stop at createContext')
      const createContext = vi
        .fn<Hydrator['createContext']>()
        .mockRejectedValue(sentinel)
      const add = vi.fn(
        (
          _schema: { $lxm: string },
          _config: {
            handler: (input: HandlerInput) => Promise<unknown>
          },
        ) => {},
      )
      const features = atmosphere
        ? {
            Gate,
            checkGate: (gate: Gate) =>
              gate === Gate.AtmosphereScreenEndpointsEnable,
          }
        : { Gate: { AATest: 'AATest' }, checkGate: () => false }
      const ctx = {
        authVerifier: {
          standardOptional: () => {},
          standard: () => {},
          optionalStandardOrRole: () => {},
          role: () => {},
          standardOptionalParameterized: () => () => {},
          parseCreds: () => ({ viewer: 'did:plc:viewer' }),
        },
        reqLabelers: () => ({ dids: [], redact: new Set() }),
        featureGatesClient: {
          parseUserContextFromHandler: () => ({}),
          scope: () => features,
        },
        hydrator: { createContext },
        rolodexClient: {},
        cfg: atmosphere
          ? { atmosphereExploreTabService: 'https://example.invalid/' }
          : {},
      }
      register({ add } as unknown as Server, ctx as unknown as AppContext)

      expect(add).toHaveBeenCalledTimes(1)
      const [registeredSchema, { handler }] = add.mock.calls[0]
      expect(registeredSchema).toBe(schema)
      await expect(
        handler({
          params: {},
          auth: { credentials: { iss: 'did:plc:viewer' } },
          req: { header: () => undefined },
        }),
      ).rejects.toBe(sentinel)
      expect(createContext).toHaveBeenCalledTimes(1)
      expect(createContext).toHaveBeenCalledWith(
        expect.objectContaining({ xrpcEndpoint: schema.$lxm }),
      )
    },
  )
})
